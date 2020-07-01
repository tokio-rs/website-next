import * as api from "../lib/api";
import Page from "../lib/page";

const menu = {
  tokio: {
    title: "Tokio",
    nested: {
      overview: {
        nested: ["reliable", "fast", "easy", "flexible"],
      },
      tutorial: {
        nested: ["hello-tokio", "spawning", "shared-state", "channels", "io", "select"],
      },
      topics: {
        nested: ["async", "concurrency", "features"],
      },
      glossary: {},
      api: {
        title: "API documentation",
        href: "https://docs.rs/tokio",
      },
    },
  },
};

export default Page;

export async function getStaticPaths() {
  return api.getMenuPaths(menu);
}

export async function getStaticProps({ params: { slug } }) {
  return api.withAppProps(await api.getProps(menu, slug));
}
