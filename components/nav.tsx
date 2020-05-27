import React, { FC, useCallback, useState } from "react";
import classnames from "classnames";
import Link from "next/link";
import SocialLinks from "./social-links";

const Brand: FC = () => (
  <Link href="/">
    <a className="navbar-item">
      <img
        src="/img/tokio-horizontal.svg"
        alt="tokio-logo"
        width="133"
        height="56"
      />
    </a>
  </Link>
);

const SectionLink: FC<{ href: string }> = ({ href, children }) => (
  <Link href={href}>
    <a className="navbar-item navbar-text">{children}</a>
  </Link>
);

// TODO: Blog needs to link to latest post
const Navigation: FC = () => {
  const [expanded, setExpanded] = useState(false);

  const toggleNav = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <nav
      className="navbar is-spaced"
      role="navigation"
      aria-label="main navigation"
    >
      <div className="container">
        <div className="navbar-brand">
          <Brand />
          <a
            role="button"
            className={classnames("navbar-burger", {
              "is-active": expanded,
            })}
            aria-label="menu"
            aria-expanded="false"
            onClick={() => toggleNav()}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </a>
        </div>
        <div
          className={classnames("navbar-menu", {
            "is-active": expanded,
          })}
        >
          <div className="navbar-end">
            <SectionLink href="/blog">Blog</SectionLink>
            <SectionLink href="/community">Community</SectionLink>
            <SectionLink href="/docs/overview">Docs</SectionLink>
            <hr className="is-hidden-touch" />
            <SocialLinks />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
