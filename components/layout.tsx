import Head from 'next/head'
import Navigation from './nav'

export default function Layout({ children }) {
    return (
        <>
            <Head>
                <title>Tokio</title>
                <meta name="viewport" content="width=device-width, initial-scale=1"></meta>
                <script src="https://use.fontawesome.com/e6423403d1.js"></script>
                {/* <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet"></link> */}
            </Head>
            <Navigation />

            <section className="section">
                <div className="container">
                    <h1 className="title">
                        Hello World
                        </h1>
                    {children}
                </div>
            </section>
        </>
    )
}