import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1 className="h1">Privacy</h1>
          <p className="lede">
            The short version: this site keeps nothing about you or your repositories on a server.
          </p>
        </div>
      </header>
      <section className="band">
        <h2 className="h3">What happens when you analyze a GitHub URL</h2>
        <p>
          Your browser sends the URL to the server. The server downloads the public repository from
          GitHub into temporary storage, analyzes it, streams the report back and deletes the
          temporary files. It does not keep the repository or the report. Only public repositories
          are accepted.
        </p>
        <h2 className="h3">What is stored in your browser</h2>
        <p>
          Reports you create are saved in this browser (IndexedDB) so you can reopen them, and your
          display settings are saved in local storage. Nothing is sent anywhere. Delete everything
          from the Settings page.
        </p>
        <h2 className="h3">What happens when you open a report file</h2>
        <p>The file is read in your browser and never uploaded.</p>
        <h2 className="h3">Cookies and tracking</h2>
        <p>
          There are no cookies, no analytics and no third party scripts. Fonts are served from this
          site. The only outside request the page makes by itself is to the public GitHub API for
          the star count.
        </p>
        <h2 className="h3">Limits of this statement</h2>
        <p>
          The hosting provider keeps its own operational logs such as request times and addresses.
          Those are outside this application and are governed by the provider's terms.
        </p>
      </section>
    </div>
  );
}
