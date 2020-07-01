---
title: "Select & Join"
---

So far, when we wanted to add concurrency to the system, we spawned a new task.
We will now cover some additional ways to concurrently execute asynchronous code
with Tokio.

# `tokio::select!`

The `tokio::select!` allows waiting on muliple async computations and returns
when a **single** computation completes.

For example:

```rust
#[tokio::main]
async fn main() {
    let t1 = task::spawn(async { "one" });
    let t2 = task::spawn(async { "two" });

    tokio::select! {
        val = t1 => {
            println!("t1 completed first with {}", val);
        }
        val = t2 => {
            println!("t2 completed first with {}", val);
        }
    }
}
```

Two tasks are spanwed. These tasks immediately return a value. Either task could
complete first. The `select!` statement awaits on both tasks and binds `val` to
the value returned by the task. When either `t1` or `t2` complete, the
associated block is executed.

The branch that **does** not complete is dropped. In the example, the
computation is awaiting the `Joinhandle` for each spawned task. The `JoinHandle`
for the task that did not complete yet is dropped.

[[info]]
| In asynchronous Rust, dropping an asynchronous computation before it completes
| is used to signal cancellation. The next page will cover this in more depth.

## Syntax

The `select!` macro can handle more than two branches. The current limit is 64
branches. Each branch is structured as:

```
<pattern> = <async expression> => <handler>,
```

When the `select` macro is evaluated, all the `<async expression>`s are
aggregated and executed concurrently. When the **first** expression completes,
the result is matched against `<pattern>`. If the result matches the pattern,
then all remaining async expressions are dropped and `<handler>` is executed.
The `<handler>` expression has access to any bindings established by
`<pattern>`. 

The basic case is `<pattern>` is a variable name, the result of the async
expression is bound to the variable name and `<handler>` has access to that
variable. This is why, in the original example, `val` was used for `<pattern>`
and `<handler>` was able to access `val`.

If `<pattern>` **does not** match the result of the async computation, then the
remaining async expressions continue to execute concurrently until the next one
completes. At this time, the same logic is applied to that result.

Because `select!` takes any async expression, it is possible to define more
complicated computation to select on.

Here, we select on the output of a `oneshot` channel and a TCP connection.

```rust
use tokio::net::TcpStream;
use tokio::sync::oneshot;

#[tokio::main]
async fn main() {
    let (tx, rx) = oneshot::channel();

    // Spawn a task that sends a message over the oneshot
    tokio::spawn(async move {
        tx.send("done").unwrap();
    });

    tokio::select! {
        socket = TcpStream::connect("localhost:3465") => {
            println!("Socket connected {:?}", socket);
        }
        msg = rx => {
            println!("received message first {:?}", msg);
        }
    }
}
```

Here, we select on a oneshot and accepting sockets from a `TcpListener`.

```rust
#[tokio::main]
async fn main() -> io::Result<()> {
    let (tx, rx) = oneshot::channel();

    tokio::spawn(async move {
        tx.send(()).unwrap();
    });

    let mut listener = TcpListener::bind("localhost:3465").await?;

    tokio::select! {
        _ = async {
            loop {
                let (socket, _) = listener.accept().await?;
                tokio::spawn(async move { process(socket) });
            }
        } => {}
        _ => rx => {
            println!("terminating accept loop");
        }
    }

    Ok(())
}
```

The accept loop runs until an error is encountered or `rx` receives a value. The
`_` pattern indicates that we have no interest in the result of the async
computation.

## Return value

The `tokio::select!` macro returns the result of the evaluated `<handler>` expression. 

```rust
async fn computation1() -> String {
    // .. computation
# unimplemented!();
}

async fn computation2() -> String {
    // .. computation
# unimplemented!();
}

#[tokio::main]
async fn main() {
    let out = tokio::select! {
        res1 = computation1() => res1,
        res2 = computation2() => res2,
    };

    println!("Got = {}", out);
}
```

Because of this, it is required that the `<handler>` expression for **each**
branch evaluates to the same type. If the output of a `select!` expression is
not needed, it is good practice to have the expression evaluate to `()`.

## Errors

Using the `?` operator immediately propagates the error out of the `select!`
expression. Let's look at the accept loop example again:

```rust
#[tokio::main]
async fn main() -> io::Result<()> {
    // [setup `rx` oneshot channel]
# let (tx, rx) = oneshot::channel();

    let mut listener = TcpListener::bind("localhost:3465").await?;

    tokio::select! {
        _ = async {
            loop {
                let (socket, _) = listener.accept().await?;
                tokio::spawn(async move { process(socket) });
            }
        } => {}
        _ => rx => {
            println!("terminating accept loop");
        }
    }

    Ok(())
}
```

Notice `listener.accept().await?`. The `?` operate propagates errors by
returning `Err`. The containing function is the `main` function. On `accept()`
error, the main function returns with the error.

The same applies for `?` used in `<handler>` expressions.

## Pattern matching

Recall that the `select!` macro branch syntax was defined as:

```
<pattern> = <async expression> => <handler>,
```

So far, we have only used variable bindings for `<pattern>`. However, any Rust pattern can be used. For example, say we are receiving from multiple MPSC channels, we might do something like this:

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx1, rx1) = mpsc::channel(128);
    let (tx2, rx2) = mpsc::channel(128);

    tokio::spawn(async move {
        // Do something w/ `tx1` and `tx2`
# tx1.send(1).unwrap();
# tx2.send(2).unwrap();
    });

    tokio::select! {
        Some(v) = rx1.recv() => {
            println!("Got {:?} from rx1", v);
        }
        Some(v) = rx2.recv() => {
            println!("Got {:?} from rx2", v);
        }
        else {
            println!("Both channels closed");
        }
    }
}
```

In this example, the `select!` expression waits on receiving a value from `rx1`
and `rx2`. If a channel closes, `recv()` returns `None`. This **does not** match
the pattern and the branch is disabled. The `select!` expression will continue
waiting on the remaining branches.

Notice that this `select!` expression includes an `else` branch. The `select!`
expression must evaluate to a value. When using pattern matching, it is possible
that **none** of the branches match their associated patterns. If this happens,
the `else` branch is evaluated.

## Borrowing

TODO

## Loops

TODO

# `tokio::join!`

TODO

# `tokio::try_join!`

TODO

# Per-task concurrency

Multiplexing asynchronous computations on a single task.