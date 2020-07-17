---
title: "Tutorial"
subtitle: "Overview"
---

Tokio is an asynchronous runtime for the Rust programming language. It provides
the building blocks needed for writing networking applications. It gives the
flexibility to target a wide range of systems, from large servers with dozens of
cores to small embedded devices.

At a high level, Tokio provides a few major components:

 - A multi-threaded runtime for executing asynchronous code.
 - An asynchronous version of the standard library.
 - A large ecosystem of libraries.

# Tokio's role in your project

When you write your application in an asynchronous manner, you enable it to
scale much better, by making the cost of doing many things at the same time
virtually zero. However, asynchronous Rust code does not run on its own, so you
must choose a runtime to execute it.  The Tokio library is the most widely used
such runtime, surpassing all others in usage combined.

Additionally, Tokio provides many useful utilities. When writing asynchronous
code, you cannot use the ordinary blocking APIs provided by the Rust standard
library, and must instead use asynchronous versions of them. These alternate
versions are provided by Tokio, mirroring the API of the Rust standard library
where it makes sense.

# Advantages of Tokio

This section will outline some advantages of Tokio.

## Fast

Tokio is _fast_, built on top of the Rust programming language, which itself is
fast. This is done in the spirit of Rust with the goal that you should not be
able to improve the performance by writing equivalent code by hand.

Tokio is _scalable_, built on top of the async/await language feature, which
itself is scalable. When dealing with networking, there's a limit to how fast
you can handle a connection due to latency, so the only way to scale is to
handle many connections at once. With the async/await language feature,
increasing the number of concurrent operations becomes incredibly cheap,
allowing you to scale the number of tasks massively.

## Reliable

Tokio is built on top of Rust's strong type system and novel trait resolution.
This enables users to build software with the ability to focus on the task at
hand instead of worrying if their code will work. Generally, if it compiles, it
will work.

Tokio also focuses heavily on providing consistent behaviour with no surprises.
This means low latencies with unheard of tail latencies. Tokio's major goal is
to allow users to deploy predictable software that will perform the same day in
and day out.

Additionally, Tokio has a large test suite with everything from integration
tests to proper model-checked concurrency tests using the [loom] model checker.

[loom]: https://github.com/tokio-rs/loom

## Easy

Tokio follows very closely to the standard library's naming convention when it
makes sense. This allows easy conversion between code written with only the
standard library to code written with Tokio. With the strong type system, the
ability to deliver correct code easily is unparalleled.

Additionally, with good documentation and a large ecosystem of libraries, you
will quickly be able to be productive with your project.

## Flexible

Tokio provides multiple variations of the runtime. Everything from a
multi-threaded, [work-stealing] runtime to a light-weight, single-threaded
runtime. Each of these runtimes come with many knobs to allow users to tune them
to their needs.

[work-stealing]: https://en.wikipedia.org/wiki/Work_stealing

# When to not use Tokio

Although Tokio is useful for many projects that need to do a lot of things
simultaneously, there are also some use-cases where Tokio is not a good fit.

 - Doing a lot of computations in a multi-threaded manner. Tokio is best fit for
   workflows that spend most of their time waiting things such as IO or timers.
   If you need to perform a lot of computations, consider using [rayon] instead.
   See also [this section][cpu-bound] from the API reference.
 - Reading a lot of files. Although it seems like Tokio would be useful for
   projects that simply need to read a lot of files, Tokio provides no advantage
   here compared to an ordinary threadpool. This is because operating systems
   generally do not provide asynchronous file APIs.
 - Sending a single web request. If you need to use a library intended for
   asynchronous Rust such as [reqwest], but you don't need to do a lot of things
   at once, you should prefer the blocking version of that library, as it will
   make your project simpler. Using Tokio will still work, of course, but
   provides no real advantage over the blocking API.

[rayon]: https://docs.rs/rayon/
[reqwest]: https://docs.rs/reqwest/
[cpu-bound]: https://docs.rs/tokio/0.2/tokio/index.html#cpu-bound-tasks-and-blocking-code

# Getting Help

At any point, if you get stuck, you can always get help on [Discord] or [GitHub
discussions][disc]. Don't worry about asking "beginner" questions. We all start
somewhere and are happy to help.

[discord]: https://discord.gg/tokio
[disc]: https://github.com/tokio-rs/tokio/discussions
