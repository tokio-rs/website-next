import React from "react";

import Hero from "../components/hero";
import Layout from "../components/layout";
import Footer from "../components/footer";
import Libs from "../components/libs";
import Logos from "../components/logos";
import TokioStack from "../components/tokio-stack";
import * as api from "../lib/api";

export default function Home({ app }) {
  return (
    <Layout blog={app.blog}>
      <div className="tk-landing">
        <Hero />
        <Logos />
        <Libs />
        <TokioStack />
      </div>
      <Footer />
    </Layout>
  );
}

export async function getStaticProps() {
  return await api.withAppProps();
}
