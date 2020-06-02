import React, { FC, useCallback, useState } from "react";

type Id =
  | "tokio"
  | "tower"
  | "runtime"
  | "hyper"
  | "tracing"
  | "mio"
  | "tonic"
  | "bytes";

type Library = {
  id: Id;
  short?: string;
  name: string;
  desc: string;
  href?: string;
};

const LIBS = new Map()
  .set("tokio", {
    id: "tokio",
    name: "The Stack",
    short: "Stack",
    desc:
      "Applications aren't built in a vacuum. The Tokio stack includes everything needed to ship to production, fast.",
  })
  .set("runtime", {
    id: "runtime",
    name: "Runtime",
    desc:
      "Including I/O, timer, filesystem, synchronization, and scheduling facilities, the Tokio runtime is the foundation of asynchronous applications.",
  })
  .set("hyper", {
    id: "hyper",
    name: "Hyper",
    desc:
      "An HTTP client and server library supporting both the HTTP 1 and 2 protocols.",
    href: "https://github.com/hyperium/hyper",
  })
  .set("tonic", {
    id: "tonic",
    name: "Tonic",
    desc:
      "A boilerplate-free gRPC client and server library. The easiest way to expose and consume an API over the network.",
    href: "https://github.com/hyperium/tonic",
  })
  .set("tower", {
    id: "tower",
    name: "Tower",
    desc:
      "Modular components for building reliable clients and servers. Includes retry, load-balancing, filtering, request-limiting facilities, and more.",
    href: "https://github.com/tower-rs/tower",
  })
  .set("mio", {
    id: "mio",
    name: "Mio",
    desc:
      "Minimal portable API on top of the operating-system's evented I/O API.",
    href: "https://github.com/tokio-rs/mio",
  })
  .set("tracing", {
    id: "tracing",
    name: "Tracing",
    desc:
      "Unified visibility into the application and libraries. Provides structured, event-based, data collection and logging.",
    href: "https://github.com/tokio-rs/tracing",
  })
  .set("bytes", {
    id: "bytes",
    name: "Bytes",
    desc:
      "At the core, networking applications manipulate byte streams. Bytes provides a rich set of utilities for manipulating byte arrays.",
    href: "https://github.com/tokio-rs/bytes",
  });

type NavItemProps = {
  lib: Library;
  current: Id;
  onClick(id: Id): void;
};

const NavItem: FC<NavItemProps> = ({ lib, current, onClick }) => {
  return (
    <li className={`tk-lib-${lib.id} ${current === lib.id ? "is-active" : ""}`}>
      <a href={`#${lib.id}`} onClick={() => onClick(lib.id)}>
        {lib.short || lib.name}
      </a>
    </li>
  );
};

type MenuProps = {
  current: Id;
  onClick(id: Id): void;
};

const Menu: FC<MenuProps> = ({ current, onClick }) => {
  return (
    <div className="column is-1 tk-menu is-hidden-touch">
      <div className="container anchor">
        <aside className="menu">
          <ul className="menu-list">
            {Array.from(LIBS.values()).map((lib) => (
              <NavItem
                key={lib.id}
                lib={lib}
                current={current}
                onClick={onClick}
              />
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};

const TokioLib: FC<{ lib: Library }> = ({ lib }) => {
  return (
    <div className="card">
      <div className={`card-content tk-lib-${lib.id}`}>
        <div className="media">
          <div className="media-content">
            <a
              id={`${lib.id}`}
              style={{
                display: "block",
                position: "relative",
                top: "-13rem",
                visibility: "hidden",
              }}
            />
            <h1 className="title is-4">
              <img src={`/img/icons/${lib.id}.svg`} alt={lib.id} />
              {lib.name || lib.short}
            </h1>
          </div>
        </div>
        <div className="content">
          <h2 className="subtitle">{lib.desc}</h2>
        </div>
      </div>
    </div>
  );
};

type ImageProps = {
  id: Id;
  current: Id;
};

const StackImage: FC<ImageProps> = ({ id, current }) => {
  return (
    <img
      className={`${
        id === current || current === "tokio" ? "tk-stack-active" : ""
      }`}
      alt={id}
      src={`/img/stack-${id}.svg`}
    />
  );
};

const StackImages: FC<{ current: Id }> = ({ current }) => {
  return (
    <div className="column is-half is-hidden-mobile">
      <div className="container anchor">
        <img
          id="tk-stack-lines"
          data-stack-id="lines"
          className={`${current === "tracing" ? "tk-stack-active" : ""}`}
          src="/img/stack-lines.svg"
          alt={"lines"}
        />

        <StackImage id="tracing" current={current} />
        <StackImage id="bytes" current={current} />
        <StackImage id="mio" current={current} />
        <StackImage id="runtime" current={current} />
        <StackImage id="hyper" current={current} />
        <StackImage id="tonic" current={current} />
        <StackImage id="tower" current={current} />
      </div>
    </div>
  );
};

const TokioStack: FC = () => {
  const [currentId, setCurrentId] = useState<Id>("tokio");
  const handleClick = useCallback((id: Id) => setCurrentId(id), []);

  return (
    <section className="tk-stack">
      <div className="container">
        <div className="columns">
          <Menu current={currentId} onClick={handleClick} />

          <div className="column is-5-desktop is-half-tablet tk-libs">
            {Array.from(LIBS.values()).map((lib) => (
              <TokioLib key={lib.id} lib={lib} />
            ))}
          </div>

          <StackImages current={currentId} />
        </div>
      </div>
    </section>
  );
};

export default TokioStack;
