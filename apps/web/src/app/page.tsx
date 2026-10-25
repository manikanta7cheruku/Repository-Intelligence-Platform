import Link from "next/link";
import { AnalyzeForm } from "@/components/analyze-form";

const QUESTIONS: [string, string, string][] = [
  ["What is this repository, and how far can I trust the analysis?", "Briefing", "briefing"],
  ["What should I fix first?", "Priorities", "priorities"],
  ["How is the code organized, and where are the cycles?", "Structure", "structure"],
  ["What could break if I change this file?", "Impact", "impact"],
  ["Which files are costly to change, and why?", "Risk", "risk"],
  ["Is anything in the dependencies, secrets or CI worth worrying about?", "Security", "security"],
  ["How has the project been worked on over time?", "History", "history"],
];

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Repository Intelligence Platform</p>
          <h1 className="display">Understand a codebase before you change it.</h1>
          <p className="lede lede-lg">
            RIP reads a repository, maps how its parts depend on each other, and tells you what is
            risky, what is well made and what to do first. Every number comes with the evidence
            behind it.
          </p>
          <p className="hero-links">
            <Link className="btn btn-quiet" href="/r/sample/briefing">
              Open a sample report
            </Link>
            <Link className="textlink" href="/how-it-works">
              How it works
            </Link>
          </p>
        </div>
        <div className="hero-panel" id="analyze">
          <AnalyzeForm />
        </div>
      </section>

      <section className="band">
        <h2 className="h2">One report, seven questions</h2>
        <p className="lede">
          The report follows the order in which people ask about an unfamiliar codebase.
        </p>
        <ol className="qlist">
          {QUESTIONS.map(([q, label, slug], i) => (
            <li key={slug}>
              <span className="qnum num">{String(i + 1).padStart(2, "0")}</span>
              <span className="qtext">{q}</span>
              <Link className="qlink" href={`/r/sample/${slug}`}>
                {label}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="band split">
        <div>
          <h2 className="h2">A proof for every score</h2>
          <p className="lede">
            A score is only useful if you can check it. Each one opens into the inputs it was built
            from, the curve that turned a measurement into points, and the files behind it. If an
            input could not be measured, it is excluded and said so. It is never counted as zero.
          </p>
        </div>
        <figure className="proof-sample" aria-label="Example of a score proof">
          <figcaption className="small muted">
            Example: Architecture score of a real repository
          </figcaption>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Input</th>
                <th scope="col" className="right">
                  Measured
                </th>
                <th scope="col" className="right">
                  Score
                </th>
                <th scope="col" className="right">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Files in import cycles</td>
                <td className="right num">0 of 132</td>
                <td className="right num">100</td>
                <td className="right num">35%</td>
              </tr>
              <tr>
                <td>Modules in cycles</td>
                <td className="right num">0 of 14</td>
                <td className="right num">100</td>
                <td className="right num">15%</td>
              </tr>
              <tr>
                <td>Unresolved imports</td>
                <td className="right num">0 of 319</td>
                <td className="right num">100</td>
                <td className="right num">15%</td>
              </tr>
              <tr>
                <td>Files importing too much</td>
                <td className="right num">0 of 132</td>
                <td className="right num">100</td>
                <td className="right num">10%</td>
              </tr>
              <tr className="is-off">
                <td>Rule violations</td>
                <td className="right">no rules file</td>
                <td className="right">excluded</td>
                <td className="right num">25%</td>
              </tr>
            </tbody>
          </table>
          <p className="small muted">
            Four of five inputs had data, so the score is built from 75 percent of its weight and
            says so.
          </p>
        </figure>
      </section>

      <section className="band">
        <h2 className="h2">What it checks, and what it does not</h2>
        <div className="cols-2 cols-ruled">
          <div>
            <h3 className="h4">Checks</h3>
            <ul className="plain-list">
              <li>
                Imports and dependencies in TypeScript, JavaScript and Python, cycles and modules
              </li>
              <li>Function complexity, size and duplicated code</li>
              <li>
                Known vulnerable dependency versions through OSV, committed secrets, risky CI
                settings
              </li>
              <li>Tests, CI, documentation, community files, decision records</li>
              <li>Git history: hotspots, contributors, commit habits</li>
            </ul>
          </div>
          <div>
            <h3 className="h4">Does not</h3>
            <ul className="plain-list">
              <li>Run the code or its tests, so it cannot find behavior bugs</li>
              <li>Follow dynamic imports or framework wiring, so impact is a minimum set</li>
              <li>
                Parse Python fully: its imports are read as text, and the report lowers confidence
              </li>
              <li>Use machine learning. Every score is a formula you can read</li>
              <li>
                Prove a repository is secure. A clean result only means these checks found nothing
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="band">
        <h2 className="h2">Run it on your machine</h2>
        <p className="lede">
          The same engine ships as a command line tool. Reports it writes open here without
          uploading anything.
        </p>
        <pre className="code">{`repolens analyze . -f json,html -o report
repolens impact report/report.json src/lib/api.ts
repolens pr --base main --fail-on-regression`}</pre>
        <p>
          <Link className="textlink" href="/run-free">
            Four free ways to use it
          </Link>
        </p>
      </section>
    </div>
  );
}
