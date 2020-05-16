export default function Hero() {
  return (
    <section className="hero is-primary tk-intro">
      <div className="hero-body container has-text-centered">
        <h1 className="title"> The asynchronous run-time for the Rust programming language </h1>
        <h2 className="subtitle">
          Tokio is an open source library providing an asynchronous, event
          driven platform for building fast, reliable, and lightweight network
          applications. It leverages Rust's ownership and concurrency model to
          ensure thread safety.
          </h2>
        <a className="button">Get Started</a>
      </div>
    </section >
  );
}
