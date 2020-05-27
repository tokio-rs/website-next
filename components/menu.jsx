export default function Menu({ href, menu }) {
  const groups = Object.entries(menu).map(([key, { title, nested }]) => {
    return (
      <React.Fragment key={key}>
        <p className="menu-label">Tokio</p>
        <Level1 href={href} menu={nested} />
      </React.Fragment>
    );
  });

  return (
    <aside className="menu">
      {groups}

      {/* TODO: hook this up, only when needed */}
      <p className="menu-label">
        <img
          src="/img/left-arrow.svg"
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            height: "0.8rem",
            marginRight: "0.5rem",
          }}
        />
        <a>All Libraries</a>
      </p>
    </aside>
  );
}

function Level1({ href, menu }) {
  const items = pagesFor(menu).map((entry) => {
    const isActive = href.startsWith(entry.href);
    const hasNested = isActive && entry.nested !== undefined;
    const className = isActive ? "is-active" : "";

    return (
      <li key={entry.key} className={className}>
        <a href={entry.href}>{entry.title}</a>
        {hasNested && (
          <ul>
            <Level2 href={href} menu={entry.nested} />
          </ul>
        )}
      </li>
    );
  });

  return <ul className="menu-list">{items}</ul>;
}

function Level2({ href, menu }) {
  const items = pagesFor(menu).map((page) => {
    const className = href.startsWith(page.href) ? "is-active" : "";
    return (
      <li key={page.key} className={className}>
        <a href={page.href}>{page.title}</a>
      </li>
    );
  });

  return <ul>{items}</ul>;
}

function pagesFor(menu) {
  return Object.entries(menu).map(([, entry]) => {
    if (entry.page) {
      return {
        nested: entry.nested,
        ...entry.page,
      };
    } else {
      return entry;
    }
  });
}
