---
title: "Select & Join"
---

So far, when we wanted to add concurrency to the system, we spawned a new task.
We will now cover some additional ways to concurrently execute asynchronous code
with Tokio.

# `select!`

The `tokio::select!` allows waiting on muliple async computations and returns
when the **first** computation completes.

For example:

```rust
#[tokio::main]
async fn main() {
    let t1 = task::spawn(async { "one" });
    let t2 = task::spawn(async { "two" });

    tokio::select! {
        val = t1 => {
            println!("t1 is first with {}", val);
        }
        val = t2 => {
            println!("t2 is first with {}", val);
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
        tx.send("done");
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

Here, we select on the mapped output of a `oneshot` and reading all the data
from TCP stream.

```rust
```

## Return value

TODO

## Pattern matching

TODO

## Default branch

TODO

## Borrowing

TODO

## Loops

TODO

# `join!`

TODO

# Per-task concurrency

Multiplexing asynchronous computations on a single task.