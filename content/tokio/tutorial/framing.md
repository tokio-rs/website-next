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

Let's break this down. First, `read_frame` operates in a loop. First,
`self.parse_frame()` is called. This will attempt to parse a redis frame from
`self.buffer`. If there is enough data to parse a frame, the frame is returned
to the caller of `read_frame()`. Otherwise, we attempt to read more data from
the socket into the buffer.

## The `Buf` trait

TODO: what up