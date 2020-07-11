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

## Implementing `Future`

Let's implement a very simple future. This future will:

1. Wait until a specific instant in time.
2. Output some text to STDOUT.
3. Yield a string.

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

struct Delay {
    when: Instant,
}

impl Future for Delay {
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
    let when = Instant::now() + Duration::from_millis(10);
    let future = Delay { when };

    let out = future.await;
    assert_eq!(out, "done");
}
```

## Async fn as a Future

In the main function, we instantiate the future and call `.await` on it. From
async functions, we may call `.await` on any value that implements `Future`. In
turn, calling an `async` function returns an anonymous type that implements
`Future`. In the case of `async fn main()`, the generated future is roughly:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

enum MainFuture {
    // Initialized, never polled
    State0,
    // Waiting on `Delay`, i.e. the `future.await` line.
    State1(Delay),
    // The future has completed.
    Terminated,
}
# struct Delay { when: Instant };
# impl Future for Delay {
#     type Output = &'static str;
#     fn poll(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<&'static str> {
#         unimplemented!();
#     }
# }

impl Future for MainFuture {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>)
        -> Poll<()>
    {
        use MainFuture::*;

        loop {
            match *self {
                State0 => {
                    let when = Instant::now() +
                        Duration::from_millis(10);
                    let future = Delay { when };
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

Rust futures are **state machines**. Here, `MainFuture` is represented as an
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
question is, what calls `poll` on the very most outer future?

Recall from earlier, to run asynchronous functions, they must either be
passed to `tokio::spawn` or be the main function annotated with
`#[tokio::main]`. This results in submitting the generated outer future to the
Tokio executor. The executor is responsible for calling `Future::poll` on the
outer future and thus driving the asynchronous computation to completion.

## Mini Tokio

To better understand how this all fits together, lets implement our own minimal
version of Tokio! The full code can be found [here][mini-tokio]

```rust
use std::collections::VecDeque;
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use futures::task;

fn main() {
    let mut mini_tokio = MiniTokio::new();

    mini_tokio.spawn(async {
        let when = Instant::now() + Duration::from_millis(10);
        let future = Delay { when };

        let out = future.await;
        assert_eq!(out, "done");
    });

    mini_tokio.run();
}
# struct Delay { when: Instant }
# impl Future for Delay {
#     type Output = &'static str;
#     fn poll(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<&'static str> {
#         Poll::Ready("done")
#     }
# }

struct MiniTokio {
    tasks: VecDeque<Task>,
}

type Task = Pin<Box<dyn Future<Output = ()> + Send>>;

impl MiniTokio {
    fn new() -> MiniTokio {
        MiniTokio {
            tasks: VecDeque::new(),
        }
    }
    
    /// Spawn a future onto the mini-tokio instance.
    fn spawn<F>(&mut self, future: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.tasks.push_back(Box::pin(future));
    }
    
    fn run(&mut self) {
        let waker = task::noop_waker();
        let mut cx = Context::from_waker(&waker);
        
        while let Some(mut task) = self.tasks.pop_front() {
            if task.as_mut().poll(&mut cx).is_pending() {
                self.tasks.push_back(task);
            }
        }
    }
}
```

This runs the async block. A `Delay` instance is created with the requested
delay and is awaited on. However, our implementation so far as a major **flaw**.
Our executor never goes to sleep. The executor continuously loops **all**
spawned futures and polls them. Most of the time, the futures will not be ready
to perform more work and will return `Poll::Pending` again. The process will
burn CPU and generally not be very efficient.

Ideally, we want mini-tokio to only poll futures when the future is able to make
progress. This happens when a resource that the task is blocked on becomes ready
to perform the requested operation. If the task wants to read data from a TCP
socket, then we only want to poll the task when the TCP socket has received
data. In our case, the task is blocked on the given `Instant` being reached.
Ideally, mini-tokio would only poll the task once that instance in time has
passed.

To achieve this, when a task polls a resource, and the resource is **not**
ready, the resource will notify the task once it transitions to a ready state.

# Wakers

Wakes are the missing piece. This is the system by which a resource is able to
notify the waiting task that the resource has become ready to complete an
operation.

Let's look at the `Future::poll` definition again:

```rust,compile_fail
fn poll(self: Pin<&mut Self>, cx: &mut Context)
    -> Poll<Self::Output>;
```

The `Context` argument to `poll` has a `waker()` method. This method returns a
[`Waker`] bound to the current task. The [`Waker`] has `wake()` method. Calling
this method signals to the executor that the associated task should be scheduled
for execution. Resources call `wake()` when they transition to a ready state in
order to notify the executor that polling the task will be able to make
progress.

## Updating `Delay`

We can update `Delay` to use wakers:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use std::thread;

# struct Delay {
#     when: Instant,
# }
impl Future for Delay {
    type Output = &'static str;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>)
        -> Poll<&'static str>
    {
        if Instant::now() >= self.when {
            println!("Hello world");
            Poll::Ready("done")
        } else {
            // Get a handle to the waker for the current task
            let waker = cx.waker().clone();
            let when = self.when;

            // Spawn a timer thread.
            thread::spawn(move || {
                let now = Instant::now();

                if now < when {
                    thread::sleep(when - now);
                }

                waker.wake();
            });

            Poll::Pending
        }
    }
}
```

Now, once the requested duration has elapsed, the calling task is notified and
the executor can ensure the task is scheduled again. The next step is to update
mini-tokio to listen for wake notifications.

There are still a few remaining issues with our `Delay` implementation. We will
fix them later.

[[warning]]
| When a future returns `Poll::Pending`, it **must** ensure the waker is
| signalled at some point in the future. Forgetting to do this results
| in the task hanging indefinitely.
|
| Forgetting to wake a task after returning `Poll::Pending` is a common
| source of bugs.

## Updating Mini Tokio

The next step is updating Mini Tokio to receive waker notifications. We want the
executor to only run tasks when they are woken. To do this, Mini Tokio
implements its waker. When the waker is invoked, its associated task is queued
to be executed. This waker is passed to the root future when it is polled.

Mini Tokio is updated to to use a channel to store scheduled tasks. Channels
allow tasks to be queued for execution from any thread. Wakers must be `Send`
and `Sync`. Channels support these requirements.

Add the following dependency to your `Cargo.toml` to pull in channels.

```toml
crossbeam = "0.7"
```

Then, update the `MiniTokio` struct.

```rust
use crossbeam::channel;
use std::sync::Arc;

struct MiniTokio {
    scheduled: channel::Receiver<Arc<Task>>,
    sender: channel::Sender<Arc<Task>>,
}

struct Task {
    // This will be filled in soon.
}
```

Wakers are `Sync` and can be cloned. When `wake` is called, the task must be
scheduled for execution. To implement this, we have a channel. When the `wake()`
is called on the waker, the task is pushed into the send have of the channel.
Our `Task` structure will implement the wake logic. To do this, it needs to
contain both the spawned future and the channel send half.

```rust
# use std::future::Future;
# use std::pin::Pin;
# use std::sync::{Arc, Mutex};
# use crossbeam::channel;
struct Task {
    future: Mutex<Pin<Box<dyn Future<Output = ()> + Send>>>,
    executor: channel::Sender<Arc<Task>>,
}

impl Task {
    fn schedule(self: &Arc<Self>) {
        self.executor.send(self.clone());
    }
}
```

To schedule the task, the `Arc` is cloned and sent through the channel. Now, we
need to hook our `schedule` function with `std::task::Waker`. The standard
library provides a low-level API to do this using [manual vtable
construction][vtable]. This strategy provides maximum flexibility to
implementors, but requires a bunch of unsafe boilerplate code. Instead of using
`RawWakerVTable` directly, we will use the [`ArcWake`] utility provided by the
[`futures`] crate. This allows us to implement a simple trait to expose our
`Task` struct as a waker.

Add the following dependency to your `Cargo.toml` to pull in `futures`.

```toml
futures = "0.3"
```

Then implement `futures::task::ArcWake`.

```rust
use futures::task::ArcWake;
use std::sync::Arc;
# struct Task {}
# impl Task {
#     fn schedule(self: &Arc<Self>) {}
# }
impl ArcWake for Task {
    fn wake_by_ref(arc_self: &Arc<Self>) {
        arc_self.schedule();
    }
}
```

Now, when the timer thread above calls `waker.wake()`, the task is pushed into
the channel. Next, we implement receiving and executing the tasks in the
`MiniTokio::run()` function.

[trait]: https://doc.rust-lang.org/std/future/trait.Future.html
[pin]: https://doc.rust-lang.org/std/pin/index.html
[`Waker`]: https://doc.rust-lang.org/std/task/struct.Waker.html
[mini-tokio]: #
[vtable]: https://doc.rust-lang.org/std/task/struct.RawWakerVTable.html
[`ArcWake`]: https://docs.rs/futures/0.3/futures/task/trait.ArcWake.html
[`futures`]: https://docs.rs/futures/