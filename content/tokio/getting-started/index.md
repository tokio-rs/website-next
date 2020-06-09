---
title: "Getting Started"
---

This tutorial will take you step by step through the process of building a
[Redis] client and server. We will start with the basics of asynchronous
programing with Rust and build up from there. We will implement a subset of
Redis commands but will get a comprehensive tour of Tokio.

# Mini-Redis

You can find the full implementation of [Mini-Redis on GitHub][mini-redis]. THe
source is well commented to aid in reading along. We will also use the
Mini-Redis server to test our client as we write it. This way, we don't have to
worry about installing real Redis.

# Getting Help

At any point, if you get stuck, you can always get help on [Discord] or [GitHub
discussions][disc]. Don't worry about asking "beginner" questions. We all start
somewhere and are happy to help.

[discord]: https://discord.gg/tokio
[disc]: https://github.com/tokio-rs/tokio/discussions

# Prerequisites

Readers should already be familiar with the [Rust]. The [Rust book][book] is an
excellent resource to get started with.

You should already have a basic idea about **what** Tokio is. If not, start
[here].

While not required, some experience with writing networking code using the [Rust
standard library][std] or another language can be helpful.

No pre-existing knowledge of Redis is required.

[here]: /tokio/overview
[rust]: https://rust-lang.org
[book]: https://doc.rust-lang.org/book/
[std]: doc.rust-lang.org/std/

## Rust

Before getting started, you should make sure that you have the
[Rust][install-rust] toolchain installed and ready to go. If you don't have it,
the easiest way to install it is using [rustup].

This tutorial requires a minimum of Rust version `1.39.0`. However, it is
recommended to have the most recent stable Rust version.

To check that Rust is installed on your computer, run the following:

```bash
$ rustc --version
```

You should see output like `rustc 1.43.1 (8d69840ab 2020-05-04)`.

## Mini-Redis server

Next, install the Mini-Redis server. This will be used to test our client as we
build it.

```bash
$ cargo install mini-redis
```

Make sure that it was successfully installed by starting the server:

```bash
$ mini-redis-server
```

Then try to get the key `foo` using `mini-redis-cli`

```bash
$ mini-redis-cli get foo
```

You should see `(nil)`.

# Ready to go

That's it, everything is ready to go. Go to the next page to write your first
asynchronous Rust application.

[redis]: https://redis.io
[mini-redis]: https://github.com/tokio-rs/mini-redis
[install-rust]: https://www.rust-lang.org/tools/install
[rustup]: https://rustup.rs/
