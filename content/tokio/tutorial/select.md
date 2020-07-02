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
use tokio::sync::oneshot;

#[tokio::main]
async fn main() {
    let (tx1, rx1) = oneshot::channel();
    let (tx2, rx2) = oneshot::channel();

    tokio::spawn(async {
        let _ = tx1.send("one");
    });

    tokio::spawn(async {
        let _ = tx2.send("two");
    });

    tokio::select! {
        val = rx1 => {
            println!("rx1 completed first with {}", val);
        }
        val = rx2 => {
            println!("rx2 completed first with {}", val);
        }
    }
}
```

Two oneshot channels are used. Either channel could complete first. The
`select!` statement awaits on both channels and binds `val` to the value
returned by the task. When either `tx1` or `tx2` complete, the associated block
is executed.

The branch that **does not** complete is dropped. In the example, the
computation is awaiting the `oneshot::Receiver` for each channel. The
`oneshot::Receiver` for the channel that did not complete yet is dropped.

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
aggregated and executed concurrently. When an expression completes, the result
is matched against `<pattern>`. If the result matches the pattern, then all
remaining async expressions are dropped and `<handler>` is executed. The
`<handler>` expression has access to any bindings established by `<pattern>`. If
multiple branches complete simultaneously, one will be picked randomly. This
provides a level of fairness.

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
async fn main() {
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

Using the `?` operator propagages the error from the expression. How this works
depends on whether `?` is used from an async expression> or from a handler.
Using `?` in an async expression propagates the error out of the async
expression. This makes the output of the async expression a `Result`. Using `?`
from a handler immediately propagates the error out of the `select!` expression.
Let's look at the accept loop example again:

```rust
#[tokio::main]
async fn main() -> io::Result<()> {
    // [setup `rx` oneshot channel]
# let (tx, rx) = oneshot::channel();

    let mut listener = TcpListener::bind("localhost:3465").await?;

    tokio::select! {
        res = async {
            loop {
                let (socket, _) = listener.accept().await?;
                tokio::spawn(async move { process(socket) });
            }
        } => {
            res?;
        }
        _ => rx => {
            println!("terminating accept loop");
        }
    }

    Ok(())
}
```

Notice `listener.accept().await?`. The `?` operator propagates the error out of
that expression and to the `res` binding. On an error, `res` will be set to
`Err(_)`. Then, in the handler, the `?` operator is used again. The `res?` statement will propagate an error out of the `main` function.

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

When spawning tasks, the spawned async expression must own all of its data. The
`select!` macro does not have this limitation. Each branch's async expression
may borrow data and operate concurrently. Following Rust's borrow rules,
multiple async expressions may immutably borrow a single piece of data **or** a
single async expression may mutably borrow a piece of data.

Let's look at some examples. Here, we simultaneously send the same data to two
different TCP destinations.

```rust
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use std::io;
use std::net::SocketAddr;

async fn race(
    data: &[u8],
    addr1: SocketAddr,
    addr2: SocketAddr
) -> io::Result<()> {
    tokio::select! {
        Ok(_) = async {
            let socket = TcpStream::connect(addr1).await?;
            socket.write_all(data).await?;
            Ok(())
        } => {}
        Ok(_) = async {
            let socket = TcpStream::connect(addr1).await?;
            socket.write_all(data).await?;
            Ok(())
        } => {}
        else => {}
    }
    let socket1 = TcpStream::connect(addr1).await?
    let socket2 = TcpStream::
}
# fn main() {}
```

The `data` variable is being borrowed **immutably** from both async expressions.
When one of the operations completes successfully, the other one is dropped.
Because we pattern match on `Ok(_)`, if an expression fails, the other one
continues to execute.

When it comes to each branch's `<handler>`, `select!` guarantees that only a
single `<handler>` runs. Because of this, each `<handler>` may mutably borrow
the same data.

For example:

```rust
use tokio::sync::oneshot;

#[tokio::main]
async fn main() {
    let (tx1, rx1) = oneshot::channel();
    let (tx2, rx2) = oneshot::channel();

    let mut out = String::new();

    // Send values on `tx1` and `tx2`.
#   tokio::spawn(async {
#        let _ = tx1.send("one");
#        let _ = tx2.send("two");
#    });

    tokio::select! {
        _ = rx1 => {
            out.push_str("rx1 completed");
        }
        _ = rx2 => {
            out.push_str("rx2 completed");
        }
    }

    println!("{}", out);
}
```

## Loops

TODO

# `tokio::join!`

TODO

# `tokio::try_join!`

TODO

# Per-task concurrency

Multiplexing asynchronous computations on a single task.