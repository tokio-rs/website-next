---
title: "Channels"
---

Now that we have learned some about concurrency with Tokio, let's apply this on
the client side. Say we want to run two concurrent Redis commands. We can spawn
one task per command. Then the two commands would happen concurrently.

At first, we might try something like:

```rust
use mini_redis::Client;

#[tokio::main]
async fn main() {
    // Establish a connection to the server
    let mut client = client::connect("127.0.0.1:6379").await.unwrap();

    // Spawn two tasks, one gets a key, the other sets a key
    let t1 = tokio::spawn(async {
        let res = client.get("hello").await;
    });

    let t2 = tokio::spawn(async {
        client.set("foo", "bar".into()).await;
    });

    t1.await.unwrap();
    t2.await.unwrap();
}
```

This does not compile because both tasks need to access the `client` somehow.
As `Client` does not implement `Copy`, it will not compile without some code to
facilitate this sharing. Additionally, `Client::set` takes `&mut self`, which
means that exclusive access is required to call it. We could open a connection
per task, but that is not ideal. We cannot use `std::sync::Mutex` as `.await`
would need to be called with the lock held. We could use `tokio::sync::Mutex`,
but that would only allow a single in-flight request. If the client implements
[pipelining], an async mutex results in underutilizing the connection.

[pipelining]: https://redis.io/topics/pipelining

# Message passing

The answer is to use message passing. The pattern involves spawning a dedicated
task to manage the `client` resource. Any task that wishes to issue a request
sends a message to the `client` task. The `client` task issues the request on
behalf of the sender, and the response is sent back to the sender.

Using this strategy, a single connection is established. The task managing
`client` is able to get mutable access in order to call `get` and `set`.
Additionally, the channel works as a buffer. Operations may be sent to the
`client` task while the `client` task is busy. Once the `client` task is
available to process new requests, it pulls the next request from the channel.
This can result in better throughput, and be extended to support connection
pooling.

# Tokio's channel primitives

Tokio provides a [number of channels][channels], each serving a different purpose.

- [mpsc]: multi-producer, single-consumer channel. Many values can be sent.
- [oneshot]: single-producer, single consumer channel. A single value can be sent.
- [broadcast]: multi-producer, multi-consumer. Many values can be send. Each
  receiver sees every value.
- [watch]: multi-producer, multi-consumer. Many values can be sent, but no
  history is kept. Receivers only see the most recent value.

In this section, we will use [mpsc] and [oneshot]. The others will be used in
later sections. The full code from this section is found [here][full].

[channels]: https://docs.rs/tokio/0.2/tokio/sync/index.html
[mpsc]: https://docs.rs/tokio/0.2/tokio/sync/mpsc/index.html
[oneshot]: https://docs.rs/tokio/0.2/tokio/sync/oneshot/index.html
[broadcast]: https://docs.rs/tokio/0.2/tokio/sync/broadcast/index.html
[watch]: https://docs.rs/tokio/0.2/tokio/sync/watch/index.html
[full]: https://github.com/tokio-rs/website-next/blob/master/tutorial-code/channels/src/main.rs

# Define the message type

In most cases, when using message passing, the task receiving the messages
responds to more than one command. In our case, the task will respond to GET and
SET commands. To model this, we first define a `Command` enum and include a
variant for each command type.

```rust
use bytes::Bytes;

#[derive(Debug)]
enum Command {
    Get {
        key: String,
    },
    Set {
        key: String,
        val: Bytes,
    }
}
```

# Create the channel

In the `main` function, an `mpsc` channel is created.

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    // Create a new channel with a capacity of at most 32.
    let (tx, rx) = mpsc::channel(32);

    // ... Rest comes here
}
```

The `mpsc` channel is picked to **send** commands to the task managing the redis
connection. The multi-producer capability allows messages to be sent from many
tasks. Creating the channel returns two values, a sender and a receiver. The two
handles are used separately. They may be moved to different tasks.

The channel is created with a capacity of 32. If messages are sent faster than
they are received, the channel will store them. Once the 32 messages are stored
in the channel, calling `send(...).await` will block until a message has been
removed by the receiver.

Sending from multiple tasks is done by **cloning** the `Sender`. For example:

```rust
#[tokio::main]
async fn main() {
    let (tx, rx) = mpsc::channel(32);
    let tx2 = tx.clone();

    tokio::spawn(async move {
        tx.send("sending from first handle").await;
    });

    tokio::spawn(async move {
        tx2.send("sending from second handle").await;
    });

    while let Some(message) = rx.recv().await {
        println!("GOT = {}", message);
    }
}
```

Both messages are send to the **single** `Receiver` handle. This handle **may
not** be cloned.

When all `Sender` handles drop, it is impossible to send more messages into the
channel. At this point, the **send half** of the channel is closed. The receive
half is notified of this by receiving `None`. In our case, when `None` is
received, we shut down the task managing the connection. As no further commands
are received, the connection to Redis is no longer needed.

# Spawn manager task

Next, spawn a task that processes messages from the channel. First, a client
connection is established to Redis. Then, received commands are issued via the
redis connection.

```rust
// The `move` keyword is used to **move** ownership of `rx` into the task.
let manager = tokio::spawn(async move {
    // Establish a connection to the server
    let mut client = client::connect("127.0.0.1:6379").await.unwrap();

    // Start receiving messages
    while let Some(cmd) = rx.recv().await {
        use Command::*;

        match cmd {
            Get { key } => {
                client.get(&key).await;
            }
            Set { key, val } => {
                client.set(&key, val).await;
            }
        }
    }
});
```

Now, update the two tasks to send commands over the channel instead of issuing
them directly on the Redis connection.

```rust
// The `Sender` handles are moved into the tasks. As there are two
// tasks, we need a second `Sender`.
let tx2 = tx.clone();

// Spawn two tasks, one gets a key, the other sets a key
let t1 = tokio::spawn(async move {
    let cmd = Command::Get {
        key: "hello".to_string(),
    };

    tx.send(cmd).await.unwrap();
});

let t2 = tokio::spawn(async {
    let cmd = Command::Set {
        key: "foo".to_string(),
        val: "bar".into(),
    };

    tx2.send(cmd).await.unwrap();
});
````

At the bottom of the `main` function, we `.await` the join handles to ensure the
commands fully complete before the process exits.

```rust
t1.await.unwrap();
t2.await.unwrap();
manager.await.unwrap();
```

# Receive responses

The final step is to receive the response back from the manager task. The `GET`
command needs to get the value and the `SET` command needs to know if the
operation completed successfully.

To pass the response, `oneshot` is used. The `oneshot` channel is a
single-producer, single-consumer channel optimized for sending a single value.
In our case, the single value is the response.

Similar to `mpssc`, `oneshot::channel()` returns separate sender and receiver
handles.

```rust
use tokio::sync::oneshot;

let (tx, rx) = oneshot::channel();
```

Unlike `mpsc`, no capacity is specified as the capacity is always one.
Additionally, neither handles can be cloned.

To receive responses from the manager task, before sending a command a `oneshot`
channel is created. The `Sender` half of the channel is included in the command
to the manager task. The receive half is used to receive the response.

First, update `Command` to include the `Sender`. First convenience, a type alias
is used to reference the `Sender`.

```rust
/// Multiple different commands are multiplexed over a single channel.
#[derive(Debug)]
enum Command {
    Get {
        key: String,
        resp: Responder<Option<Bytes>>,
    },
    Set {
        key: String,
        val: Vec<u8>,
        resp: Responder<()>,
    },
}

/// Provided by the requester and used by the manager task to send the command
/// response back to the requester.
type Responder<T> = oneshot::Sender<mini_redis::Result<T>>;
```

TODO: reset of the section

# Backpressure
