import type { Metadata } from "next";
import { PipelineDiagram } from "@/components/pipeline-diagram";
import { REPO_URL } from "@/components/site-chrome";

export const metadata: Metadata = { title: "How it works" };

const STACK: [string, string][] = [
  [
    "Engine",
    "TypeScript (strict) in a pnpm monorepo. One package, @repolens/core, is shared by the command line tool and this site.",
  ],
  [
    "Code parsing",
    "The TypeScript compiler API for JavaScript and TypeScript. Python imports are read as text after comments and strings are blanked.",
  ],
  [
    "Graph",
    "Import edges, modules by directory, cycles by Tarjan's strongly connected components (iterative), reachability by breadth first search.",
  ],
  [
    "Web",
    "Next.js (App Router) and React. The site reads only the report JSON and the glossary, never engine internals.",
  ],
  [
    "Storage",
    "None on the server. Reports live in your browser (IndexedDB) and can be downloaded.",
  ],
  [
    "Tests",
    "Vitest. Real Git repositories in tests, fixture repositories with hand-written ground truth, schema validation of every generated report.",
  ],
];

export default function HowItWorks() {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="h1">How RIP is built</h1>
          <p className="lede">
            RIP is deterministic static analysis. The same repository gives the same report, every
            score is a formula you can read, and no code from the analyzed repository is ever
            executed.
          </p>
        </div>
      </header>

      <PipelineDiagram />

      <section className="band">
        <h2 className="h2">How a repository is read</h2>
        <ol className="steps">
          <li>
            <b>Bounded intake.</b> A local folder is walked in sorted order without following
            symbolic links. A GitHub URL is validated (github.com only, no credentials, no IP hosts)
            and downloaded as an archive that a defensive reader unpacks, rejecting path traversal,
            links, devices and oversized entries.
          </li>
          <li>
            <b>Classification.</b> Every file gets a language and a kind (source, test, generated,
            vendored, binary) and line counts. Exclusions are counted and reported, never silent.
          </li>
          <li>
            <b>Understanding code.</b> Each import is resolved to an internal file, a third party
            package, a built-in or an unresolved reference with a reason. Functions get a cyclomatic
            complexity.
          </li>
          <li>
            <b>Judgment from evidence.</b> Findings carry evidence, location, confidence and limits.
            Scores combine named inputs through published curves, and say how much of their weight
            had data.
          </li>
        </ol>
      </section>

      <section className="band split">
        <div>
          <h2 className="h2">Why no machine learning</h2>
          <p className="lede">
            Prediction needs labeled data this project does not have, and explanation matters more
            than cleverness here.
          </p>
        </div>
        <ul className="plain-list">
          <li>
            <b>Explainable.</b> A user can ask why and get a formula and the files behind it.
          </li>
          <li>
            <b>No training data.</b> Predicting defects needs thousands of repositories with known
            bug history. Inventing it would be dishonest.
          </li>
          <li>
            <b>Repeatable.</b> The same input gives the same report, which a test enforces.
          </li>
          <li>
            <b>Private.</b> Code is read as text and never sent to a model.
          </li>
          <li>
            <b>Exact where possible.</b> Imports, cycles and vulnerable versions are computed, not
            estimated.
          </li>
        </ul>
      </section>

      <section className="band">
        <h2 className="h2">Honest limits</h2>
        <ul className="plain-list">
          <li>
            Scoring curves and risk weights are provisional choices, labeled as such in every
            report. Calibration on real repositories is planned work.
          </li>
          <li>
            Impact follows static imports. Dynamic imports and framework wiring are not seen, so
            impact is a minimum set.
          </li>
          <li>
            Python is read at support level 2. Architecture confidence is capped for repositories
            that contain it.
          </li>
          <li>Remote history is a sample of recent commits with no per-file data.</li>
          <li>A clean report does not prove a repository is secure or well designed.</li>
        </ul>
      </section>

      <section className="band">
        <h2 className="h2">Stack</h2>
        <dl className="stack">
          {STACK.map(([k, v]) => (
            <div key={k} className="stack-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p>
          Decisions are recorded as architecture decision records in{" "}
          <a
            className="textlink"
            href={`${REPO_URL}/tree/main/docs/adr`}
            target="_blank"
            rel="noopener noreferrer"
          >
            docs/adr
          </a>
          .
        </p>
      </section>
    </div>
  );
}
