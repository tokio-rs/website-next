---
title: "Hello Redis"
---

We will get started by writing a very basic Tokio application. It will connect
to the Mini-Redis server, set the value of the key `hello` to `world`. It will
then read back the key. This will be done using the Mini-Redis client library.

# Writing the code

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
