import Layout from "../components/layout";
import Libs from "../components/libs";
import Logos from "../components/logos";
import Hero from "../components/hero";

export default function Home() {
  return (
    <Layout>
      <Hero />
      <Logos />
      <Libs />
    </Layout>
  );
}
