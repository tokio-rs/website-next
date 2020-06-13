---
title: "Channels"
---

Now that we have learned some about concurrency with Tokio, let's apply this on
the client side. Say we want to run two concurrent SET requests. We can spawn one task per request. Then the two requests would happen concurrently.

At first, we might try something like:

```rust
use mini_redis::Client;

#[tokio::main]
async fn main() {
    // Establish a connection to the server
    let mut client = client::connect("127.0.0.1:6379").await.unwrap();

    // Spawn two tasks, each setting a value
    let t1 = tokio::spawn(async {
        client.set("hello", "world".into());
    });

    let t2 = tokio::spawn(async {
        client.set("foo", "bar".into());
    });

    t1.await.unwrap();
    t2.await.unwrap();
}
```

This does not compile. `client` needs to be moved into the tasks somehow.
However, `Client` does not implement `Clone`. Additionally, `Client::set`
require `&mut self`. We could open a connection per task, but that is not ideal.
We cannot use `std::sync::Mutex` as the critical section is async. We could use
`tokio::sync::Mutex`, but that would only allow a single in-flight request. If
the client implements [pipelining], an async mutex results in underutilizing the
connection.

[pipelining]: https://redis.io/topics/pipelining

# Message passing

The answer is to use message passing. The pattern involves spawning a dedicated
task to manage the `client` resource. Any task that wishes to issue a request
sends a message to the `client` task. The `client` task issues the request on
behalf of the sender. The response is then forward to the sender.

Using this strategy, a single connection is established. The task managing
`client` is able to get mutable access in order to call `set`. Additionally, the
channel works as a buffer. Operations may be sent to the `client` task while the
`client` task is busy. Once the `client` task is available to process new
requests, it pulls the next request from the channel. This can result in better
throughput.

# Tokio's channel primitives

Tokio provides a [number of channels][channels], each surve a different purpose.

- [mpsc]: multi-producer, single-consumer channel. Many values can be sent.
- [oneshot]: single-producer, single consumer channel. A single value can be sent.
- [broadcast]: multi-producer, multi-consumer. Many values can be send. Each receiver sees each value.
- [watch]: multi-producer, multi-consumer. Many values can be sent, but no history is kept. Receivers only see the "most recent value".

In this section, we will use [mpsc] and [oneshot]. The others will be used in later sections.

[channels]: https://docs.rs/tokio/0.2.21/tokio/sync/index.html
[mpsc]: https://docs.rs/tokio/0.2.21/tokio/sync/mpsc/index.html
[oneshot]: https://docs.rs/tokio/0.2.21/tokio/sync/oneshot/index.html
[broadcast]: https://docs.rs/tokio/0.2.21/tokio/sync/broadcast/index.html
[watch]: https://docs.rs/tokio/0.2.21/tokio/sync/watch/index.html

# Spawning manager task

The first step is to spawn the task to manage the connection. A mpsc
sender/receiver pair is created. The receiver is moved into a task. The client
connects and the task starts listening for requests to send on the channel
receiver.

```rust
use tokio::sync::mpsc;
use mini_redis::Client;

#[tokio::main]
async fn main() {
    // Create a new channel with a capacity of at most 32.
    let (tx, rx) = mpsc::channel(32);

    tokio::spawn(async move {
        // Establish a connection to the server
        let mut client = client::connect("127.0.0.1:6379").await.unwrap();

        // Start receiving messages
        while let Some(cmd) = rx.recv().await {
            unimplemented!();
        }
    })

    // Spawn two tasks, each setting a value
    let t1 = tokio::spawn(async {
        client.set("hello", "world".into());
    });

    let t2 = tokio::spawn(async {
        client.set("foo", "bar".into());
    });

    t1.await.unwrap();
    t2.await.unwrap();
}
```

## Backpressure