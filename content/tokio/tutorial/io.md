---
title: "I/O"
---

I/O in Tokio operates in much the same way as `std`, but asynchronous. There is
a trait for reading ([`AsyncRead`]) and a trait for writing ([`AsyncWrite`]).
Specific types implement these traits as appropriate ([`TcpStream`], [`File`],
[`Stdout`]). [`AsyncRead`] and [`AsyncWrite`] are also implemented by a number
of data structures, such as `Vec<u8>` and `&[u8]`. This allows using byte arrays
where a reader or writer is expected.

# `AsyncRead` and `AsyncWrite`

These two traits provide the facilities to asynchronously read from and write to
byte streams. However, unlike `std`, these traits are intended to be
**implemented** and not called directly. Instead, consumers of these traits will
use utility methods provided by [`AsyncReadExt`] and [`AsyncWriteExt`]. Those
two traits are where familiar methods are found.

Let's briefly look at a few of these methods.

## `async fn read()`

[`AsyncReadExt::read`][read] provides an async method for reading data into a
buffer, returning the number of bytes read.

```rust
use tokio::fs::File;
use tokio::io::{self, AsyncReadExt};

#[tokio::main]
async fn main() -> io::Result<()> {
    let mut f = File::open("foo.txt").await?;
    let mut buffer = [0; 10];

    // read up to 10 bytes
    let n = f.read(&mut buffer[..]).await?;

    println!("The bytes: {:?}", &buffer[..n]);
    Ok(())
}
```

## `async fn write()`

[`AsyncReadExt::read_to_end`][read_to_end] reads all bytes from the stream until
EOF.

```rust
use tokio::io::{self, AsyncReadExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let mut f = File::open("foo.txt").await?;
    let mut buffer = Vec::new();

    // read the whole file
    f.read_to_end(&mut buffer).await?;
    Ok(())
}
```

## `async fn write()`

[`AsyncWriteExt::write`][write] writes a buffer into the writer, returning how
many bytes were written.

```rust
use tokio::io::{self, AsyncWriteExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let mut file = File::create("foo.txt").await?;

    // Writes some prefix of the byte string, not necessarily all of it.
    file.write(b"some bytes").await?;
    Ok(())
}
```

## `async fn write_all()`

[`AsyncWriteExt::write_all`][write_all] writes the entire buffer into the
writer.

```rust
use tokio::io::{self, AsyncWriteExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let mut buffer = File::create("foo.txt").await?;

    buffer.write_all(b"some bytes").await?;
    Ok(())
}
```

Both traits include a number of other helpful methods. See the API docs for a
comprehensive list.

# Helper functions

Additionally, just like `std`, the [`tokio::io`] module contains a number of
helpful utility functions as well as APIs for working with [standard in][stdin],
[standard out][stdout] and [standard error][stderr]. For example,
[`tokio::io::copy`][copy] asynchronously copies the entire contents of a reader
into a writer.

```rust
use tokio::io;

let mut reader: &[u8] = b"hello";
let mut file = File::create("foo.txt").await?;

io::copy(&mut reader, &mut file).await?;
```

[`AsyncRead`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncRead.html
[`AsyncWrite`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWrite.html
[`AsyncReadExt`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncReadExt.html
[`AsyncWriteExt`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWriteExt.html
[`TcpStream`]: https://docs.rs/tokio/0.2/tokio/net/struct.TcpStream.html
[`File`]: https://docs.rs/tokio/0.2/tokio/fs/struct.File.html
[`Stdout`]: https://docs.rs/tokio/0.2/tokio/io/struct.Stdout.html
[read]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncReadExt.html#method.read
[read_to_end]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncReadExt.html#method.read_to_end
[write]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWriteExt.html#method.write
[`tokio::io`]: https://docs.rs/tokio/0.2/tokio/io/index.html
[stdin]: https://docs.rs/tokio/0.2/tokio/io/fn.stdin.html
[stdout]: https://docs.rs/tokio/0.2/tokio/io/fn.stdout.html
[stderr]: https://docs.rs/tokio/0.2/tokio/io/fn.stderr.html
[copy]: https://docs.rs/tokio/0.2/tokio/io/fn.copy.html

# Echo server

TODO: Cover a few ways to implement an echo server

# Redis protocol parsing

TODO: Cover connection.rs from mini-redis