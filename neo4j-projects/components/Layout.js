import Head from "next/head";

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Panama Papers Explorer — Neo4j Fraud Detection</title>
        <meta
          name="description"
          content="Explore ICIJ Offshore Leaks data to detect shell company networks and fraud clusters using Neo4j"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="layout">
        <header className="header">
          <div className="header-content">
            <h1 className="logo">
              <span className="logo-icon">◈</span> Panama Papers Explorer
            </h1>
            <p className="subtitle">
              ICIJ Offshore Leaks — Fraud Cluster Detection with Neo4j
            </p>
          </div>
        </header>
        <main className="main">{children}</main>
        <footer className="footer">
          <p>
            Data from{" "}
            <a
              href="https://offshoreleaks.icij.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ICIJ Offshore Leaks Database
            </a>
            . Powered by{" "}
            <a
              href="https://neo4j.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Neo4j
            </a>
            .
          </p>
        </footer>
      </div>
    </>
  );
}
