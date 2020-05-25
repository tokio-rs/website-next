import fs from "fs";
import glob from "glob";
import path from "path";
import matter from "gray-matter";

const contentDir = path.join(process.cwd(), "content");

// Merge app level props in with page props
export function withAppProps(props = { props: {} }) {
  props.props.app = {
    blog: getLastBlog(),
  };

  return props;
}

export function getMenuPaths(menu) {
  let paths = collectPaths(menu).map((slug) => {
    [, ...slug] = slug.split("/");

    return {
      params: { slug },
    };
  });

  return {
    paths,
    fallback: false,
  };
}

export function getLastBlog() {
  return getDateOrderedPaths("blog")[0];
}

export function getDateOrderedPaths(root) {
  return glob
    .sync(`${contentDir}/${root}/*.md`)
    .map((fullPath) => {
      const fileContents = fs.readFileSync(fullPath, "utf-8");
      const data = matter(fileContents).data;
      const date = Date.parse(data.date);
      const key = path.basename(fullPath).replace(/\.md$/, "");

      return {
        key,
        date,
        title: data.title,
        href: `/${root}/${key}`,
      };
    })
    .sort((a, b) => {
      return b.date - a.date;
    });
}

export async function getProps(menu, root, slug) {
  if (Array.isArray(slug)) {
    slug = slug.join(path.sep);
  }

  const page = loadPage(`${root}/${slug}`);

  return withAppProps({
    props: {
      title: page.data.title,
      body: page.content,
      menu: normalize(menu, root),
      data: page.data,
    },
  });
}

// Build a list of paths from the sitemap
function collectPaths(level, prefix = "") {
  let out = [];

  for (const [k, v] of Object.entries(level)) {
    if (Object.keys(v).length == 0) {
      out.push(`${prefix}/${k}`);
    } else if ("title" in v && "pages" in v) {
      for (const [, p] of v.pages.entries()) {
        out.push(`${prefix}/${k}/${p}`);
      }
    } else {
      out = out.concat(collectPaths(v, `/${k}`));
    }
  }

  return out;
}

// Normalize the sitemap using front matter
function normalize(menu, root) {
  let out = {};

  // Level 1 of menu may be single pages or contain a sub structure
  for (const l1 of Object.keys(menu)) {
    if (!menu[l1].pages) {
      // Single page
      const base = `${root}/${l1}`;
      const page = loadPage(base).data;

      out[l1] = {
        key: l1,
        title: page.menu || page.title,
        href: `/${base}`,
      };
    } else {
      // Load front matter for sub pages
      let submenu = {};

      for (const l2 of menu[l1].pages) {
        const base = `${root}/${l1}/${l2}`;
        const page = loadPage(base).data;

        submenu[l2] = {
          key: l2,
          title: page.menu || page.title,
          href: `/${base}`,
        };
      }

      out[l1] = {
        key: l1,
        title: menu[l1].menu || menu[l1].title,
        pages: submenu,
      };
    }
  }

  return out;
}

function loadPage(path) {
  const fullPath = `${contentDir}/${path}.md`;

  const fileContents = fs.readFileSync(fullPath, "utf-8");

  // Use gray-matter to parse the post metadata section
  return matter(fileContents);
}
