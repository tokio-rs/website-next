---
title: "Framing"
---

We will now apply what we just learned about I/O and implement the Mini-Redis
framing layer. Framing is the process of taking a byte stream and converting it
to a stream of frames. A frame is a unit of data transmitted between two peers.
The Redis protocol frame is as follows:

```rust
enum Frame {
    Simple(String),
    Error(String),
    Integer(u64),
    Bulk(Bytes),
    Null,
    Array(Vec<Frame>),
}
```

Note how the frame only consists of data wihout any semantics. The command
parsing and implementation happen at a higher level.

For HTTP, a frame might look like:

```rust
enum HttpFrame {
    RequestHead {
        method: Method,
        uri: Uri,
        version: Version,
        headers: HeaderMap,
    }
    ResponseHead {
        status: StatusCode,
        version: Versi5on,
        headers: HeaderMap,
    }
    BodyChunk {
        chunk: Bytes,
    }
}
```

To implement framing for Mini-Redis, we will implement a `Connection` struct
that wraps a `TcpStream` and reads/writes `mini_redis::Frame` values.

```rust
use mini_redis::{Frame, Result};

struct Connection {
    stream: TcpStream,
    // ... other fields here
}

impl Connection {
    /// Read a frame from the connection.
    /// 
    /// Returns `None` if EOF is reached
    pub async fn read_frame(&mut self)
        -> Result<Option<Frame>> { ... }

    /// Write a frame to the connection.
    pub async fn write_frame(&mut self, frame: &Frame)
        -> Result<()> { ...}
}
```

You can find the details of the Redis wire protocol [here][proto].

[proto]: https://redis.io/topics/protocol

# Buffered reads

The `read_frame` waits for an entire frame to be received before returning. A
single call to `TcpStream::read()` may return an arbitrary amount of data. It
could contain an entire frame, a partial frame, or multiple frames. If a partial
frame is received, the data is buffered and more data is read from the socket.
If multiple frames are received, the first frame is returned and the rest of the
data is buffered until the next call to `read_frame`.

To implement this, `Connection` needs a read buffer field. Data is read from the
socket into the read buffer. When a frame is parsed, the corresponding data is
removed from the buffer.

We will use `BytesMut` as the buffer type. This is a mutable version of `Bytes`.

```rust
use bytes::BytesMut;
use tokio::net::TcpStream;

pub struct Connection {
    stream: TcpStream,
    buffer: BytesMut,
}

impl Connection {
    pub fn new(stream: TcpStream) -> Connection {
        Connection {
            stream,
            // Allocate the buffer with 4kb of capacity.
            buffer: BytesMut::with_capacity(4096),
        }
    }
}
```

Next, we implement the `read_frame()` function.

```rust
use bytes::Buf;

pub async fn read_frame(&mut self) -> Result<Option<Frame>> {
    loop {
        // Attempt to parse a frame from the buffered data. If
        // enough data has been buffered, the frame is
        // returned.
        if let Some(frame) = self.parse_frame()? {
            return Ok(Some(frame));
        }

        // There is not enough buffered data to read a frame.
        // Attempt to read more data from the socket.
        //
        // On success, the number of bytes is returned. `0`
        // indicates "end of stream".
        if 0 == self.stream.read_buf(&mut self.buffer).await? {
            // The remote closed the connection. For this to be
            // a clean shutdown, there should be no data in the
            // read buffer. If there is, this means that the
            // peer closed the socket while sending a frame.
            if self.buffer.is_empty() {
                return Ok(None);
            } else {
                return Err("connection reset by peer".into());
            }
        }
    }
}
```

Let's break this down. `read_frame` operates in a loop. First,
`self.parse_frame()` is called. This will attempt to parse a redis frame from
`self.buffer`. If there is enough data to parse a frame, the frame is returned
to the caller of `read_frame()`.Otherwise, we attempt to read more data from the
socket into the buffer. After reading more data, `parse_frame()` is called
again. This time, if enough data has been received, parsing may succeed.

When reading from the stream, a return of value `0` indicates that no more data
will be received from the peer. If the read buffer still has data in it, this
indicates a partial frame has been received and the connection is being
terminated abruptly. This is an error condition and `Err` is returned.

## The `Buf` trait

When reading from the stream, `read_buf` is called. This version of the read
function takes a value implementing [`BufMut`] from the [`bytes`] crate.

First, consider how we would implement the same read loop using `read()`.
`Vec<u8>` could be used instead of `BytesMut`.

```rust
pub struct Connection {
    stream: TcpStream,
    buffer: Vec<u8>,
    cursor: usize,
}

impl Connection {
    pub fn new(stream: TcpStream) -> Connection {
        Connection {
            stream,
            // Allocate the buffer with 4kb of capacity.
            buffer: vec![0; 4096],
        }
    }
}
```

And the `read_frame()` function on `Connection`:

```rust
pub async fn read_frame(&mut self) -> Result<Option<Frame>> {
    loop {
        if let Some(frame) = self.parse_frame()? {
            return Ok(Some(frame));
        }

        // Ensure the buffer has capacity
        if self.buffer.len() == self.cursor {
            // Grow the buffer
            self.buffer.resize(self.cursor * 2, 0);
        }

        // Read into the buffer, tracking the number of bytes read
        let n = self.stream.read(&mut self.buffer[self.cursor..]).await?

        if 0 == n {
            if self.cursor == 0 {
                return Ok(None);
            } else {
                return Err("connection reset by peer".into());
            }
        } else {
            // Update our cursor
            self.cursor += n;
        }
    }
}
```

When working with byte arrays and `read`, we must also maintain a cursor
tracking how much data has been buffered. We must ensure to pass the empty
portion of the buffer to `read()`. Otherwise, we would overwrite buffered data.
If our buffer gets filled up, we must grow the buffer in order to keep reading.
In `parse_frame()` (not included), we would need to parse data contained by
`self.buffer[..self.cursor]`.

Because pairing a byte array with a cursor is very common, the `bytes` crate
provides an abstraction representing a byte array and cursor. The `Buf` trait is
implemented by types from which data can be read. The `BufMut` trait is
implemented by types into which data can be written. When passing a `T: BufMut`
to `read_buf()`, the buffer's internal cursor is automatically updated by
`read_buf`. Because of this, in our versino of `read_frame`, we do not need to
manage our own cursor.

Additionally, when using `Vec<u8>`, the buffer must be **initialized**. `vec![0;
4096]` allocates an array of 4096 bytes and writes zero to every entry. When
resizing the buffer, the new capacity must also be initialized with zeros. The
initialization process is not free. When working with `BytesMut` and `BufMut`,
capacity is **uninitialized**. The `BytesMut` abstraction prevents us from
reading the uninitialized memory. This lets us avoid the initialization step.

[`BufMut`]: https://docs.rs/bytes/0.5/bytes/trait.BufMut.html
[`bytes`]: docs.rs/bytes/