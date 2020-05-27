import * as content from "../../lib/api";
import Page from "../../lib/page";
import util from "util";

const menuSize = 10;

export default Page;

export async function getStaticPaths() {
  const paths = content.getDateOrderedPaths("blog").map((page) => {
    return {
      params: { slug: [page.key] },
    };
  });

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params: { slug } }) {
  const paths = content.getDateOrderedPaths("blog");

  let menu = {};

  let i = 0;
  for (const page of paths) {
    if (i == menuSize) {
      break;
    }

    i += 1;

    const date = new Date(page.date);

    const year = date.getFullYear().toString();
    menu[year] = menu[year] || [];
    menu[year].push(page);
  }

  return content.withAppProps({
    props: {
      page,
      menu,
    },
  });
}
