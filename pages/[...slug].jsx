import * as api from "../lib/api";
import Page from "../lib/page";

const menu = {
  tokio: {
    title: "Tokio",
    nested: {
      overview: {
        nested: ["reliable", "fast", "easy", "flexible"],
      },
      "getting-started": {
        nested: ["hello-world"],
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
