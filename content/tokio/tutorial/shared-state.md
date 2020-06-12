---
title: "Shared state"
---

So far, we have a key-value server working. However, there is a major flaw:
state is not shared across connections. We will fix that.

# Strategies

There are a couple of different ways to share state in Tokio.

1. Guard the shared state with a Mutex.
2. Spawn a task to manage the state and use message passing to operate on it.

Spawning a task to manage state is usually the preferred strategy when
operations on the data require asynchronous work. This strategy will be used in
a later section. Right now, the state to share is a `HashMap` and the operation
are `insert` and `get`. Both of these operations are relatively short, so we
will use a `Mutex`.

# Initialize the `HashMap`

The `HashMap` will be shared across many tasks and potentially many threads. To
support this, it is wrapped with `Arc<Mutex<_>>`.

First, for convenience, add the following after the `use` statements.

```rust
use std::sync::{Arc, Mutex};

type Db = Arc<Mutex<HashMap<String, Vec<u8>>>>;
```

Then, update the `main` function to initialize the `HashMap` and pass it a
**handle** to the `process` function.

```rust
#[tokio::main]
async fn main() {
    let mut listener = TcpListener::bind("127.0.0.1:6379").await.unwrap();

    println!("Listening");

    let db = Arc::new(Mutex::new(HashMap::new()));

    loop {
        let (socket, _) = listener.accept().await.unwrap();
        // Clone the handle
        let db = db.clone();

        println!("Accepted");
        process(socket, db).await;
    }
}
```

## On using `std::sync::Mutex`

Note, `std::sync::Mutex` and **not** `tokio::sync::Mutex` is used to guard the
`HashMap` a common error is to unconditionally use `tokio::sync::Mutex` from
within async code. An async mutex is a mutex used to guard **asynchronous
critical sections**.

A synchronous mutex will block the current thread when waiting to acquire the
the lock. This, in turn, will block other tasks from processing. H  owever,
switching to `tokio::sync::Mutex` usually does not help as the asynchronous
mutex uses a synchronous mutex internally.

As a rule of thumb, using a synchronous mutex from within asynchronous code
is fine as long as contention remains low and the critical section is kept
short.

# Update `process()`

The process function no longer initializes a `HashMap`. Instead, it takes the
shared handle to the `HashMap` as an argument. It also needs to lock the
`HashMap` before using it.

```rust
async fn process(socket: TcpStream, db: Db) {
    use mini_redis::Command::{self, Get, Set};

    // Connection, provided by `mini-redis`, handles parsing frames from
    // the socket
    let mut connection = Connection::new(socket);

    while let Some(frame) = connection.read_frame().await.unwrap() {
        let response = match Command::from_frame(frame).unwrap() {
            Set(cmd) => {
                let mut db = db.lock().unwrap();
                db.insert(cmd.key().to_string(), cmd.value().to_vec());
                Frame::Simple("OK".to_string())
            }           
            Get(cmd) => {
                let db = db.lock().unwrap();
                if let Some(value) = db.get(cmd.key()) {
                    Frame::Bulk(value.clone().into())
                } else {
                    Frame::Null
                }
            }
            cmd => panic!("unimplemented {:?}", cmd),
        };

        // Write the response to the client
        connection.write_frame(&response).await.unwrap();
    }
}
```

# Tasks, threads, and contention

Using a blocking mutex to guard short critical sections is an acceptable
strategy and contention is minimal. When a lock is contended, the thread
executing the task must block and wait on the mutex. This will not only block
the current task but it will also block all other tasks scheduled on the current
thread.

By default, the Tokio runtime uses a multi-threaded scheduler. Tasks are
scheduled on any number of threads managed by the runtime. If a large number of
tasks are scheduled to execute and they all require access to the mutex, then
there will be contention. On the other hand, if the [`basic_scheduler`][basic]
is used, then the mutex will never be contended.

If a synchronous mutex contention becomes a problem, the best fix is rarely to
switch to the Tokio mutex. Instead, options to consider are:

- Switching to a dedicated task to manage state and use message passing.
- Shard the mutex
- Restructure the code to avoid the mutex.

In our case, as each *key* is indendent, mutex sharding will work well. To do
this, instead of having a single `Mutex<HashMap<_, _>>` instance, we would
introduce `N` distinct instances.

```rust
type ShardedDb = Arc<Vec<Mutex<HashMap<String, Vec<u8>>>>>;
```

Then, finding the cell for any given key becomes a two step process. First, the
key is used to identify which shard it is part of. Then, the key is looked up in
the `HashMap`.

```rust
let shard = db[hash(key) % db.len()].lock().unwrap();
shard.insert(key, value);
```

[basic]: https://docs.rs/tokio/0.2/tokio/runtime/index.html#basic-scheduler