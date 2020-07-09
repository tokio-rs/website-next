//! Demonstrates how to implement a (very) basic asynchronous rust executor and
//! timer. The goal of this file is to provide some context into how the various
//! building blocks fit together.

use std::cell::RefCell;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Waker};
use std::time::{Duration, Instant};
use std::thread;
// A utility that allows us to implement a `std::task::Waker` without having to
// use `unsafe` code.
use futures::task::{self, ArcWake};
// Used as a channel to queue scheduled tasks.
use crossbeam::channel;

/// A very basic futures executor based on a channel. When tasks are woken, they
/// are scheduled by queuing them in the send half of the channel. The executor
/// waits on the receive half and executes received tasks.
///
/// When a task is executed, the send half of the channel is passed along via
/// the task's Waker.
struct MiniTokio {
    // Receives scheduled tasks. When a task is scheduled, the associated future
    // is ready to make progress. This usually happens when a resource the task
    // uses becomes ready to perform an operation. For example, a socket
    // received data and a `read` call will succeed.
    scheduled: channel::Receiver<Arc<Task>>,

    // Send half of the scheduled channel.
    sender: channel::Sender<Arc<Task>>,
}

// An equivalent to `tokio::spawn`. When entering the mini-tokio executor, the
// `CURRENT` thread-local is set to point to that executor's channel's Send
// half. Then, spawning requires creating the `Task` harness for the given
// `future` and pushing it into the scheduled queue.
pub fn spawn<F>(future: F)
where
    F: Future<Output = ()> + Send + 'static,
{
    CURRENT.with(|cell| {
        let borrow = cell.borrow();
        let sender = borrow.as_ref().unwrap();
        Task::spawn(future, sender);
    });
}

// Asynchronous equivalent to `thread::sleep`. Awaiting on this function pauses
// for the given duration.
//
// mini-tokio implements delays by spawning a timer thread that sleeps for the
// requested duration and notifies the caller once the delay completes. A thread
// is spawned **per** call to `delay`. This is obviously a terrible
// implementation strategy and nobody should use this in production. Tokio does
// not use this strategy. However, it can be implemented with few lines of code,
// so here we are.
async fn delay(dur: Duration) {
    // `delay` is a leaf future. Sometimes, this is refered to as a "resource".
    // Other resources include sockets and channels. Resources may not be
    // implemented in terms of `async/await` as they must integrate with some
    // operating system detail. Because of this, we must manually implement the
    // `Future`.
    //
    // However, it is nice to expose the API as an `async fn`. A useful idiom is
    // to manually define a private future and then use it from a public `async
    // fn` API.
    struct Delay {
        // When to complete the delay.
        when: Instant,
        // The waker to notify once the delay has completed. The waker must be
        // accessible by both the timer thread and the future so it is wrapped
        // with `Arc<Mutex<_>>`
        waker: Option<Arc<Mutex<Waker>>>,
    }

    impl Future for Delay {
        type Output = ();

        fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<()> {
            // First, if this is the first time the future is called, spawn the
            // timer thread. If the timer thread is already running, ensure the
            // stored `Waker` matches the current task's waker.
            if let Some(waker) = &self.waker {
                let mut waker = waker.lock().unwrap();

                // Check if the stored waker matches the current task's waker.
                // This is necessary as the `Delay` future instance may move to
                // a differnt task between calls to `poll`. If this happens, the
                // waker contained by the given `Context` will differ and we
                // must update our stored waker to reflect this change.
                if !waker.will_wake(cx.waker()) {
                    *waker = cx.waker().clone();
                }
            } else {
                let when = self.when;
                let waker = Arc::new(Mutex::new(cx.waker().clone()));
                self.waker = Some(waker.clone());

                // This is the first time `poll` is called, spawn the timer thread.
                thread::spawn(move || {
                    let now = Instant::now();

                    if now < when {
                        thread::sleep(when - now);
                    }

                    // The duration has elapsed. Notify the caller by invoking
                    // the waker.
                    let waker = waker.lock().unwrap();
                    waker.wake_by_ref();
                });
            }

            if Instant::now() >= self.when {
                Poll::Ready(())
            } else {
                Poll::Pending
            }
        }
    }

    let future = Delay {
        when: Instant::now() + dur,
        waker: None,
    };

    future.await;
}

thread_local! {
    static CURRENT: RefCell<Option<channel::Sender<Arc<Task>>>> =
        RefCell::new(None);
}

// Task harness. Contains the future as well as the necessary data to schedule
// the future once it is woken.
struct Task {
    // The future is wrapped with a `Mutex` to make the `Task` structure `Sync`.
    // There will only ever be a single thread that attempts to use `future`.
    // The Tokio runtime avoids the mutex by using `unsafe` code. The box is
    // also avoided.
    future: Mutex<Pin<Box<dyn Future<Output = ()> + Send>>>,

    // When a task is notified, it is queued into this channel. The executor
    // pops notified tasks and executes them.
    executor: channel::Sender<Arc<Task>>,
}

impl MiniTokio {
    fn new() -> MiniTokio {
        let (sender, scheduled) = channel::unbounded();

        MiniTokio {
            scheduled,
            sender,
        }
    }

    fn spawn<F>(&self, future: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        Task::spawn(future, &self.sender);
    }

    fn run(&self) {
        // Set the CURRENT thread-local to point to the current executor
        CURRENT.with(|cell| {
            *cell.borrow_mut() = Some(self.sender.clone());
        });

        while let Ok(task) = self.scheduled.recv() {
            task.poll();
        }
    }
}

impl Task {
    fn spawn<F>(future: F, sender: &channel::Sender<Arc<Task>>)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let task = Arc::new(Task {
            future: Mutex::new(Box::pin(future)),
            executor: sender.clone(),
        });

        let _ = sender.send(task);
    }

    // Execute a scheduled task.
    fn poll(self: Arc<Self>) {
        // Get a waker referencing the task.
        let waker = task::waker(self.clone());
        let mut cx = Context::from_waker(&waker);

        // This will never block as only a single thread ever locks the future.
        let mut future = self.future.try_lock().unwrap();

        // Poll the future
        let _ = future.as_mut().poll(&mut cx);
    }
}

impl ArcWake for Task {
    fn wake_by_ref(arc_self: &Arc<Self>) {
        // Schedule the task for execution. The executor receives from the
        // channel and polls tasks.
        let _ = arc_self.executor.send(arc_self.clone());
    }
}

fn main() {
    let mini_tokio = MiniTokio::new();

    mini_tokio.spawn(async {
        spawn(async {
            delay(Duration::from_millis(100)).await;
            println!("world");
        });

        spawn(async {
            println!("hello");
        });

        // We haven't implemented executor shutdown, so force the process to exit.
        delay(Duration::from_millis(200)).await;
        std::process::exit(0);
    });

    mini_tokio.run();
}