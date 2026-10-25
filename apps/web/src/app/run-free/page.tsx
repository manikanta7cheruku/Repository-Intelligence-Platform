import type { Metadata } from "next";
import { REPO_URL } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Run it free" };

export default function RunFree() {
  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1 className="h1">Four free ways to use RIP</h1>
          <p className="lede">
            None of these needs a paid service. Anything about third party plans below is unverified
            and may have changed, so check the provider's own page before relying on it.
          </p>
        </div>
      </header>

      <section className="band">
        <h2 className="h2">1. The command line</h2>
        <p>
          The engine runs on Node 22 or newer. It is not published to a package registry yet, so
          build it from source.
        </p>
        <pre className="code">{`git clone ${REPO_URL}.git
cd Repository-Intelligence-Platform
corepack enable
pnpm install
pnpm build
node packages/cli/dist/index.js analyze /path/to/project -f json,html,markdown -o report`}</pre>
        <p className="small muted">Use --offline to make no network calls at all.</p>
      </section>

      <section className="band">
        <h2 className="h2">2. A check on every pull request</h2>
        <p>
          The command <span className="mono">repolens pr --base main --fail-on-regression</span>{" "}
          compares the pull request with its base and exits with code 1 when it adds a rule
          violation, a runtime cycle or a serious finding. A packaged GitHub Action is planned and
          not available yet. Until then a workflow can build the tool from source:
        </p>
        <pre className="code">{`name: RIP
on: pull_request
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pin to a commit sha>
        with:
          fetch-depth: 0
      - uses: actions/checkout@<pin to a commit sha>
        with:
          repository: manikanta7cheruku/Repository-Intelligence-Platform
          ref: <pin to a commit sha>
          path: .rip
      - run: corepack enable && pnpm --dir .rip install && pnpm --dir .rip build
      - run: node .rip/packages/cli/dist/index.js pr --base origin/\${{ github.base_ref }} --fail-on-regression`}</pre>
        <p className="small muted">
          Untested on repositories other than this one. Pin every action by commit SHA.
        </p>
      </section>

      <section className="band">
        <h2 className="h2">3. Open a report in the browser</h2>
        <p>
          Create <span className="mono">report.json</span> with the command line, then open it on
          the start page. The file is read in your browser and never uploaded.
        </p>
      </section>

      <section className="band">
        <h2 className="h2">4. Host it yourself</h2>
        <p>
          The site is a Next.js app in <span className="mono">apps/web</span> with no database. Fork
          the repository, import it into a Vercel project with the root directory set to{" "}
          <span className="mono">apps/web</span>, and optionally set a read-only{" "}
          <span className="mono">GITHUB_TOKEN</span> to raise GitHub API limits. Vercel's free plan
          is for non-commercial use and has time and memory limits per request. Those limits are
          unverified here, so read the current terms first. Large repositories may exceed them, in
          which case use the command line.
        </p>
      </section>
    </div>
  );
}
