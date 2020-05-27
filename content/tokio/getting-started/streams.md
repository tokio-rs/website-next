# Streams
    * What are streams
    * Iterators/Streams

## Stream trait
    * Defined in futures crate, tokio reexports
    * Briefly mention Stream and Future traits lifecycles. (From futures-rs to std)
    * Most of us won't use the trait directly, most of the time. (poll_next)
    
## Working with streams
    * But first, we need a stream. use tokio::stream::iter to get a Stream we can work with.
    * We can't use for x in stream yet
    * Use while let instead for imperative iteration
    * combinators (map, filter, fold) from tokio::stream::StreamExt
    * Fallible vs Infallible streams, error handling.
    * TcpStream, channels are Streams
    * futures::StreamExt

## Creating streams
    * tokio::stream::{iter, once, empty, pending}
    * channels?
    * Generators
        - in JavaScript or Dart
        - can't use them yet in Rust
        - but we can use async_stream crate
    * implementing Stream
        - simple example and/or link to another section as proposed by Alice Ryhl
    
    