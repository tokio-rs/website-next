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

TODO: Refactor mini-redis to split up `read_frame` fn