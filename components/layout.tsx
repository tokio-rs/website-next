import Head from "next/head";
import React, { FC } from "react";
import Navigation from "./nav";

const Layout: FC = ({ children }) => (
  <>
    <Head>
      <title>Tokio</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Navigation />
    {children}
  </>
);

export default Layout;
