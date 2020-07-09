---
title: "Async in depth"
---

At this point, we have completed a fairly comprehensive tour of asynchronous
Rust and Tokio. Now we will dig deeper into Rust's asynchronous runtime model.
At the very beginning of the tutorial, we hinted that asynchronous Rust takes a
unique approach. Now, we explain what that means.

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

The [associated type][assoc] `Output` is the type that the future produces once
it completes. The [`Pin`][pin] type is how Rust is able to support borrows in
`async` functions. See the [standard library][pin] documentation for more
details.

Unlike how futures are implemented in other languages, a Rust future does not
represent a computation happening in the background, rather the Rust future
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

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>)
        -> Poll<&'static str>
    {
        if Instant::now() >= self.when {
            println!("Hello world");
            Poll::Ready("done")
        } else {
            // Ignore this line for now.
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

#[tokio::main]
async fn main() {
    let when = Instant::now() + Duration::from_millis(100);
    let future = MyFuture { when };

    let out = future.await;
    assert_eq!(out, "done");
}
```

In the main function, we instantiate the future and call `.await` on it. From
async functions, we may call `.await` on any value that implements `Future`. In
turn, calling an `async` function returns an anonymous type that implements
`Future`. In the case of `async fn main()`, the generated future is roughly:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

enum AnonMainFuture {
    // Initialized, never polled
    State0,
    // Waiting on `MyFuture`, i.e. the `future.await` line.
    State1(MyFuture),
    // The future has completed.
    Terminated,
}
# struct MyFuture { when: Instant };
# impl Future for MyFuture {
#     type Output = &'static str;
#     fn poll(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<&'static str> {
#         unimplemented!();
#     }
# }

impl Future for AnonMainFuture {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>)
        -> Poll<()>
    {
        use AnonMainFuture::*;

        loop {
            match *self {
                State0 => {
                    let when = Instant::now() +
                        Duration::from_millis(100);
                    let future = MyFuture { when };
                    *self = State1(future);
                }
                State1(ref mut my_future) => {
                    match Pin::new(my_future).poll(cx) {
                        Poll::Ready(out) => {
                            assert_eq!(out, "done");
                            *self = Terminated;
                            return Poll::Ready(());
                        }
                        Poll::Pending => {
                            return Poll::Pending;
                        }
                    }
                }
                Terminated => {
                    panic!("future polled after completion")
                }
            }
        }
    }
}
```

Rust futures are **state machines**. Here, `AnonMainFuture` is represented as an
`enum` of the future's possible states. The future starts in the `State0` state.
When `poll` is invoked, the future attempts to advance its internal state as
much as possible. If the future is able to complete, `Poll::Ready` is returned
containing the output of the asynchronous computation.

If the future is **not** able to complete, usually due to resources it is
waiting on not being ready, then `Poll::Pending` is returned. Receiving
`Poll::Pending` indicates to the caller that the future will complete at a later
time and the caller should invoke `poll` again later.

We also see that futures are composed of other futures. Calling `poll` on the
outer future results in calling the inner future's `poll` function.

# Executors

Asynchronous rust functions return futures. Futures must have `poll` called on
them to advance their state. Futures are composed of other futures. So, the
question is, what calls `poll` on the very most outter future?

Recall from earlier, in order to run asynchronous functions, they must either be
passed to `tokio::spawn` or be the main function annotated with
`#[tokio::main]`. This results in submitting the generated outer future to the
Tokio executor. The executor is responsible for calling `Future::poll` on the
outer future and thus driving the asynchronous computation to completion.

To better understand how this all fits together, lets implement our own minimal
version of Tokio!

# Wakers

# Cancellation

[trait]: https://doc.rust-lang.org/std/future/trait.Future.html
[pin]: https://doc.rust-lang.org/std/pin/index.html
