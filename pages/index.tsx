import React, { FC } from "react";

import Hero from "../components/hero";
import Layout from "../components/layout";
import Footer from "../components/footer";
import Libs from "../components/libs";
import Logos from "../components/logos";
import Stack from "../components/stack";

const Home: FC = () => (
  <Layout>
    <div className="tk-landing">
      <Hero />
      <Logos />
      <Libs />
      <Stack />
    </div>
    <Footer />
  </Layout>
);

export default Home;
