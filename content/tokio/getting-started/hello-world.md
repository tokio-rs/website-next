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

## Compile-time green-threading

Rust implements asynchronous programing using feature called [`async/await`].

[[warning]]
| Note that, while other languages implement [`async/await`], Rust takes a unique
| approach. Specifically, Rust's async operations are **lazy**. This results in
| different runtime semantics.

[`async/await`]: https://en.wikipedia.org/wiki/Async/await
