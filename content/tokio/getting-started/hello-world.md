---
title: "Hello Redis"
---

We will get started by writing a very basic Tokio application. It will connect
to the Mini-Redis server, set the value of the key `hello` to `world`. It will
then read back the key. This will be done using the Mini-Redis client library.

# The code

## Generate a new crate

Let's start by generating a new Rust app:

```bash
$ cargo new hello-redis
$ cd hello-redis
```

## Add dependencies

Next, open `Cargo.toml` and add the following right below `[dependencies]`:

```toml
tokio = { version = "0.2", features = ["full"] }
mini-redis = "0.1"
```

## Write the code

Then, open `main.rs` and replace the contents of the file with:

```rust
use mini_redis::{client, Result};

#[tokio::main]
pub async fn main() -> Result<()> {
    // Open a connection to the mini-redis address.
    let mut client = client::connect("127.0.0.1:6379").await?;

    // Set the key "hello" with value "world"
    client.set("hello", "world".into()).await?;

    // Get key "hello"
    let result = client.get("hello").await?;

    println!("got value from the server; result={:?}", result);

    Ok(())
}
```

Make sure the Mini-Redis server is running. In a separate terminal window, run:

```bash
$ mini-redis-server
```

Now, run the `hello-redis` application:

```bash
$ cargo run
got value from the server; success=Some(b"world")
```

Success!

# Breaking it down

Let's take some time to go over what we just did. There isn't much code, but a
lot is happening.

```rust
let mut client = client::connect("127.0.0.1:6379").await?;
```

The `client::connect` function is provided by the `mini-redis` crate. It
asynchronously establishes a TCP connection with the specified remote address.
Once the connection is established, a `client` handle is returned. Even though
the operation is performed asynchronously, the code we write **looks**
synchronous. The only indication that the operation is asynchronous is the
`.await` operator.

## What is asynchronous programming?

With synchronous programming, a program executes in the same order that it is
written. The first line executes, the the next, and so on. When the program
encounters an operation that cannot be completed immediately, it blocks until
the operation completes. For example, establishing a TCP connection requires an
exchange with a peer over the network takes some amount of time. During this
time, the thread is blocked.

With asynchronous programming, operations that cannot complete immediately are
suspended to the background. The thread is not blocked, and can continue running
other things. Once the operation completes, the task is unsuspended and continues
processing from where it left off. Our example from before only has one task, so
nothing happens while it is suspended, but asynchronous programs typically have
many such tasks.

Although asynchronous programming can result in faster applications, it often
results in much more complicated programs. The programmer is required to track
all the state necessary to resume work once the asynchronous operation
completes. Historically, this is a tedious and error-prone task.

## Compile-time green-threading

Rust implements asynchronous programing using feature called [`async/await`].
Functions that perform asynchonous operations are labeled with the `async`
keyword. In our example, the `connect` function is defined like this:

```rust
pub async fn connect<T: ToSocketAddrs>(addr: T) -> Result<Client> {
    ...
}
```

The `async fn` definition looks like a regular synchronous function, but
operates asynchronously. Rust transforms the `async fn` at **compile** time into
a routine that operates asynchronously. Any calls to `.await` within the `async
fn` yield control back to the thread. The thread may do other work while the
operation processes in the background.

[[warning]]
| Note, while other languages implement [`async/await`], Rust takes a unique
| approach. Primarily, Rust's async operations are **lazy**. This results in
| different runtime semantics than other languages.

[`async/await`]: https://en.wikipedia.org/wiki/Async/await

If this doesn't quite make sense yet, don't worry. We will explore `async/await`
more throughout the guide.

## Using `async/await`

Async functions are called like any other Rust function. However, calling these
functions does not result in the function body executing. Instead, calling an
`async fn` returns a value representing the operation. To get the operation to
actually run, the `.await` operator is used on the return value.

For example, the given program

```rust
async fn say_world() {
    println!("world");
}

#[tokio::main]
async fn main() {
    // Calling `say_world()` does not execute the body of `say_world()`.
    let op = say_world();

    // This println! comes first
    println!("hello");

    // Calling `.await` on `op` starts executing `say_world`.
    op.await;
}
```

outputs:

```text
hello
world
```

The return value of an `async fn` is an anonymous type that implements the
[`Future`] trait.

[`Future`]: https://doc.rust-lang.org/std/future/trait.Future.html

## Async `main` function

TODO
