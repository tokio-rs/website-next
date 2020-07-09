---
title: "Async in depth"
---

At this point, we have completed a fairly comprehensive tour of asynchronous
Rust and Tokio. Now we will dig deeper into Rust's asynchronous runtime model.
At the very beginning of the tutorial, we hinted that asynchronous Rust takes a
unique approach. Now, we will explain what we meant.

# Futures

As a quick review, let's take a very basic asynchronous function. This is
nothing new compared to what the tutorial has covered so far.

```rust
use tokio::net::TcpStream;

async fn my_async_fn() {
    println!("hello from async");
    let _socket = TcpStream::connect("127.0.0.1:3000").await.unwrap();
    println!("async TCP operation complete");
}
```

We call the function and it returns some value. We call `.await` on that value.

```rust
# async fn my_async_fn() {}
#[tokio::main]
async fn main() {
    let what_is_this = my_async_fn();
    // Nothing has been printed yet.
    what_is_this.await;
    // Text has been printed and socket has been
    // established and closed.
}
```

The value returned by `my_async_fn()` is a future. A future is a value that
implements the [`std::future::Future`][trait] trait provided by the standard
library. They are values that contain the in-progress asynchronous computation.

The [`std::future::Future`][trait] trait definition is:

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Future {
    type Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context)
        -> Poll<Self::Output>;
}
```

The `Output` associated type is the type outputed by the future once it
completes. The [`Pin`][pin] type is how Rust is able to support borrows in
`async` functions. See the [standard library][pin] documentation for more
details.

Unlike future implementations from other languages, a Rust future does not
represent a computation happening in the background. Instead, the Rust future
**is** the computation itself. The owner of the future is responsible for
advancing the computation by polling the future. This is done by calling
`Future::poll`.

Let's implement a very simple future. This future will:

1. Wait until a specific instant in time.
2. Output some text to STDOUT.
3. Yield a string.

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

struct MyFuture {
    when: Instant,
}

impl Future for MyFuture {
    type Output = &'static str;

    fn poll(self: Pin<&mut Self>, cx: &mut Context)
        -> Poll<&'static str>
    {
        if Instant::now() >= self.when {
            println!("Hello world");
            Poll::Ready("done")
        } else {
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

#[tokio::main]
async fn main() {
    let when = Instant::now() +Duration::from_millis(100);
    let future = MyFuture { when };

    let out = future.await;
    assert_eq!(out, "done");
}
```

# Wakers

# Cancellation

[trait]: https://doc.rust-lang.org/std/future/trait.Future.html
[pin]: https://doc.rust-lang.org/std/pin/index.html