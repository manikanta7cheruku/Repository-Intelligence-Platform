import type { Report, Severity } from "../ir/types.js";
import { GLOSSARY_INDEX, explain } from "../glossary/glossary.js";
import { toSvg } from "./diagram.js";
import {
  dimLabel,
  glossaryIdsFor,
  improvements,
  inputLabel,
  missingInputs,
  pctText,
} from "./common.js";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const show = (v: unknown): string => (v === null || v === undefined || v === "" ? "n/a" : esc(v));
const SEV_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

/** A term with a hover explanation. The title attribute is plain text, so no script is needed. */
function term(id: string, label?: string): string {
  const g = explain(id);
  const text = label ?? g?.label ?? id;
  if (!g) return esc(text);
  return `<abbr tabindex="0" title="${esc(`${g.plain} Technically: ${g.technical} Why it matters: ${g.why}`)}">${esc(text)}</abbr>`;
}

const CSS = `
:root{--bg:#fff;--subtle:#f6f7f9;--border:#d5d9e0;--text:#14171f;--muted:#4a5160;--accent:#2457c5;--critical:#b3261e;--high:#c4501b;--medium:#a86f00;--low:#2f6b9a;--info:#5a6272;--ok:#1f7a4d;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--subtle:#151a22;--border:#2a3240;--text:#e6e9ef;--muted:#b4bbc8;--accent:#7aa2ff;--critical:#ff7b72;--high:#f0883e;--medium:#d9a441;--low:#6cb0e8;--info:#98a2b3;--ok:#4cc38a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px;border-bottom:1px solid var(--border);padding-bottom:4px}h3{font-size:15px;margin:20px 0 6px}
nav{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0;font-size:13px}a{color:var(--accent)}.muted{color:var(--muted)}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);vertical-align:top}th{background:var(--subtle);font-weight:600}
code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.tag{display:inline-block;border:1px solid currentColor;border-radius:4px;padding:0 6px;font-size:12px;font-weight:600}
.critical{color:var(--critical)}.high{color:var(--high)}.medium{color:var(--medium)}.low{color:var(--low)}.info{color:var(--info)}.ok{color:var(--ok)}
.finding{border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin:8px 0}.finding h4{margin:0 0 4px;font-size:14px}
.banner{border:1px solid var(--border);background:var(--subtle);border-radius:6px;padding:8px 12px;margin:8px 0}
.lead{font-size:16px;font-weight:600;margin:4px 0 8px}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
abbr{text-decoration:underline dotted;cursor:help}figure{margin:12px 0;border:1px solid var(--border);border-radius:6px;padding:8px;overflow-x:auto;background:var(--bg)}figcaption{font-size:12px;color:var(--muted);margin-top:4px}
details{border-top:1px solid var(--border);padding:6px 0}summary{cursor:pointer;font-weight:600}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;

function table(head: string[], rows: unknown[][], raw: Set<number> = new Set()): string {
  if (rows.length === 0) return `<p class="muted">None.</p>`;
  return `<div class="scroll"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td>${raw.has(i) ? String(c) : show(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
const list = (xs: string[]): string =>
  xs.length === 0 ? "" : `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;

/** Self-contained report page. No scripts, no external resources, every value escaped. */
export function toHtml(r: Report, opts: { maxFindings?: number } = {}): string {
  const max = opts.maxFindings ?? 200;
  const sev = (s: Severity) => `<span class="tag ${s}">${SEV_LABEL[s]}</span>`;
  const findings = r.findings
    .slice(0, max)
    .map(
      (f) => `<article class="finding" id="${esc(f.id)}"><h4>${sev(f.severity)} ${esc(f.title)}</h4>
<p class="muted"><code>${esc(f.id)}</code> | ${term("confidence")}: ${esc(f.confidence)} | ${term("origin")}: ${esc(f.origin)}${f.classification ? ` | ${term("classification")}: ${esc(f.classification)}` : ""}</p>
<p>${esc(f.explanation)}</p>
<ul><li>Locations: ${
        f.locations.length
          ? f.locations
              .slice(0, 6)
              .map((l) => `<code>${esc(l.path)}${l.startLine ? `:${l.startLine}` : ""}</code>`)
              .join(", ")
          : "none"
      }</li>
<li>Evidence: ${
        f.evidence
          .map(
            (e) =>
              `${esc(e.kind)}${e.note ? ` (${esc(e.note)})` : ""}: ${e.refs
                .slice(0, 5)
                .map((x) => `<code>${esc(x)}</code>`)
                .join(", ")}`,
          )
          .join("; ") || "none"
      }</li>
<li>Remediation: ${esc(f.remediation)}</li>${f.limitations.length ? `<li>Limitations: ${esc(f.limitations.join(" "))}</li>` : ""}</ul></article>`,
    )
    .join("\n");
  const es = r.executiveSummary;
  const scoreRows = r.scores.map((s) => [
    term(s.dimension),
    show(s.value),
    show(s.state),
    show(s.confidence),
    pctText(s.coverage),
    pctText(s.weightCoverage),
    show(s.reason),
  ]);
  const imp = improvements(r);
  const glossary = glossaryIdsFor(r)
    .map((id) => GLOSSARY_INDEX.get(id))
    .filter((g): g is NonNullable<typeof g> => g !== undefined);
  const lv = new Map(r.graph.levels.map((l) => [l.moduleId, l.level]));
  const body = `<h1>RepoLens report: ${esc(r.repository.name)}</h1>
<p class="muted">${esc(r.repository.source.type)}: ${esc(r.repository.source.location)} | commit ${show(r.repository.commitSha)} | schema ${esc(r.schemaVersion)}</p>
<p><span class="tag">${esc(r.status)}</span> ${r.repository.totalFiles} files in total: ${r.repository.codeFiles} code files (${r.repository.productionFiles} production, ${r.repository.testFiles} test), ${r.repository.analyzedCodeFiles} analyzed</p>
${r.status !== "complete" ? `<p class="banner">This report is ${term("partial-report", "partial")}. See the limitations section for what is missing.</p>` : ""}
<nav aria-label="Sections"><a href="#summary">Summary</a><a href="#scores">Scores</a><a href="#scope">Scope</a><a href="#architecture">Architecture</a><a href="#risk">Risk</a><a href="#quality">Quality</a><a href="#security">Security</a><a href="#practices">Practices</a><a href="#history">History</a><a href="#findings">Findings</a><a href="#method">Methodology</a><a href="#glossary">Glossary</a><a href="#limits">Limitations</a></nav>
<h2 id="summary">${term("executive-summary", "Executive summary")}</h2>
<p class="lead">${esc(es.headline)}</p>${list(es.overview)}
<div class="cols"><div><h3>What looks good</h3>${es.strengths.length ? list(es.strengths) : `<p class="muted">Nothing stands out yet.</p>`}</div><div><h3>What needs attention</h3>${es.concerns.length ? list(es.concerns) : `<p class="muted">Nothing needs attention from the checks that ran.</p>`}</div></div>
${es.nextSteps.length ? `<h3>Suggested next steps</h3><ol>${es.nextSteps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
<h2 id="scores">Scores</h2>
<p class="muted">Hover a term for its meaning. ${term("not-assessed")} means the inputs were missing. It never means zero.</p>
${table(["Dimension", "Score", "State", `${term("confidence")}`, `${term("coverage")}`, `${term("weight-coverage")}`, "Reason"], scoreRows, new Set([0, 3, 4, 5]))}
${
  imp.length
    ? `<h3>How to improve each score</h3>${table(
        ["Dimension", "Input", "Now (0 to 100)", "Points to gain", "What to do"],
        imp.map((i) => [
          term(i.dimension),
          term(i.input),
          i.currentScore,
          `up to ${i.gain}`,
          i.advice,
        ]),
        new Set([0, 1]),
      )}`
    : ""
}
${r.scores
  .filter((s) => s.state === "not-assessed")
  .map(
    (s) =>
      `<p class="banner">${esc(dimLabel(s.dimension))} is not assessed. To enable it: ${esc(missingInputs(s).join("; "))}.</p>`,
  )
  .join("")}
<h3>Recommendations</h3>
${table(
  ["#", "Recommendation", "Effort", "Findings"],
  r.recommendations.slice(0, 10).map((x) => [x.rank, x.title, x.effort, x.findingIds.length]),
)}
<h2 id="scope">Scope and coverage</h2>
${table(
  ["Language", "Files", "Code lines", `${term("support-level")}`, "Analyzer"],
  r.scope.languages.map((l) => [
    l.language,
    l.files,
    l.codeLines,
    l.supportLevel,
    l.analyzerId ?? "none (detection only)",
  ]),
  new Set([3]),
)}
${table(
  ["Analyzer", "Language", "Eligible files", "Analyzed", "Coverage"],
  r.coverage.map((c) => [
    c.analyzerId,
    c.language,
    c.filesEligible,
    c.filesAnalyzed,
    c.supportLevel === 1 ? "n/a (detection only)" : pctText(c.ratio),
  ]),
)}
<h3>Project detection</h3>
${table(
  ["Field", "Value"],
  [
    ["Package managers", r.detection.packageManagers.join(", ")],
    ["Frameworks", r.detection.frameworks.map((f) => f.name).join(", ")],
    ["Runtimes", r.detection.runtimes.join(", ")],
    ["Build tools", r.detection.buildTools.join(", ")],
    ["Entrypoints", r.detection.entrypoints.map((e) => e.path).join(", ")],
    ["License", r.detection.license.spdxGuess ?? r.detection.license.file],
  ],
)}
<h2 id="architecture">Architecture</h2>
<p>Observed from ${r.graph.nodes.length} source files and ${r.graph.edges.length} edges. ${term("resolution-ratio")} ${pctText(r.graph.resolution.ratio)}. ${term("module", "Modules")} are inferred from directories.</p>
${r.graph.modules.length > 0 ? `<figure>${toSvg(r)}<figcaption>Module dependency graph. Each column is a dependency level. Arrows point to what a module depends on. Modules in a ${term("cycle")} are outlined in red.</figcaption></figure>` : ""}
${table(
  [
    "Module",
    "Files",
    "Code lines",
    `${term("fan-in")}`,
    `${term("fan-out")}`,
    `${term("instability")}`,
    "Level",
  ],
  r.graph.modules.map((m) => [
    m.path,
    m.fileCount,
    m.loc,
    m.fanIn,
    m.fanOut,
    m.instability,
    lv.get(m.id),
  ]),
  new Set([3, 4, 5]),
)}
<h3>Circular dependencies</h3>
${
  r.graph.cycles.length === 0
    ? `<p class="ok">None found.</p>`
    : table(
        ["Scope", "Size", "Type-only", "Members"],
        r.graph.cycles.map((c) => [
          c.scope,
          c.size,
          c.typeOnly ? "yes" : "no",
          c.members.slice(0, 8).join(", "),
        ]),
      )
}
<h2 id="risk">${term("risk-index", "Risk")} and ${term("blast-radius", "blast radius")}</h2>
${
  r.risk.assessed
    ? `<p class="muted">${esc(r.risk.method)}</p>${table(
        ["File", "Risk (0 to 100)", "Confidence", "Why"],
        r.risk.files
          .slice(0, 10)
          .map((f) => [
            f.path,
            f.risk,
            f.confidence,
            f.drivers.join("; ") || "blend of moderate signals",
          ]),
      )}`
    : `<p class="banner">Risk index not assessed: ${esc(r.risk.reason)}</p>`
}
<h3>Blast radius of widely used files</h3>
${table(
  [
    "File",
    "Direct dependents",
    "All dependents",
    "Modules affected",
    "Entrypoints affected",
    "Depth",
  ],
  r.blastRadius
    .slice(0, 10)
    .map((b) => [
      b.path,
      b.directDependents,
      b.transitiveDependents,
      b.modulesAffected.length,
      b.entrypointsAffected.length,
      b.maxDepth,
    ]),
)}
<h2 id="quality">Code quality</h2>
<p>${r.metrics.totals.codeLines} code lines, ${r.metrics.functionCount} functions measured. ${r.metrics.duplication.assessed ? `Duplication ${pctText(r.metrics.duplication.ratio)}.` : `Duplication not assessed (${esc(r.metrics.duplication.reason)}).`}</p>
${table(
  [`${term("cyclomatic-complexity", "Function")}`, "File", "Line", "Complexity"],
  r.metrics.topFunctions
    .slice(0, 10)
    .map((f) => [f.name, f.path, f.line, `${f.complexity}${f.approximate ? " (approx.)" : ""}`]),
  new Set(),
)}
<h2 id="security">Security</h2>
<p class="banner">${esc(r.security.statement)}</p>
${table(["Check", "Assessed", "Result or reason"], [["Dependency vulnerabilities (OSV)", r.security.dependencies.assessed ? "yes" : "no", r.security.dependencies.assessed ? `${r.security.dependencies.vulnerabilities} advisories across ${r.security.dependencies.packagesChecked} packages` : r.security.dependencies.reason], ...r.security.secrets.map((s) => [`Secrets (${s.tool})`, s.assessed ? "yes" : "no", s.assessed ? `${s.findings} possible` : s.reason]), ["GitHub Actions workflows", r.security.workflows.assessed ? "yes" : "no", r.security.workflows.assessed ? `${r.security.workflows.findings} findings` : r.security.workflows.reason]])}
<h2 id="practices">Testing, CI and documentation</h2>
${table(
  ["Area", "Detected"],
  [
    ["CI", r.practices.ci.providers.join(", ")],
    ["Test frameworks", r.practices.tests.frameworks.join(", ")],
    [
      "Test coverage",
      r.testCoverage.ingested
        ? `${pctText(r.testCoverage.lineRate)} from ${r.testCoverage.source}`
        : `not ingested: ${r.testCoverage.reason}`,
    ],
    ["Linters", r.practices.quality.linters.join(", ")],
    ["Type checkers", r.practices.quality.typeCheckers.join(", ")],
    [
      "README",
      r.practices.documentation.readme.path
        ? `${r.practices.documentation.readme.words} words, sections: ${r.practices.documentation.readme.sections.join(", ") || "none"}`
        : "none",
    ],
    ["Decision records", r.practices.documentation.adrCount],
  ],
)}
<h2 id="history">Git history</h2>
${
  r.history.available
    ? `<p>${r.history.commitsAnalyzed} commits analyzed (${r.history.source === "github-api" ? "sample from the GitHub API" : "local Git"}).</p>${r.history.commitQuality ? `<p>${term("commit-quality", "Commit messages")}: ${pctText(r.history.commitQuality.conventionalShare)} follow Conventional Commits, ${pctText(r.history.commitQuality.descriptiveShare)} are descriptive, ${pctText(r.history.commitQuality.genericShare)} are generic. This is a habit signal, not a verdict.</p>` : ""}${r.history.pullRequests ? `<p>${term("pull-request-signals", "Pull requests")}: ${r.history.pullRequests.merged} merged in a recent sample of ${r.history.pullRequests.sampled}, median time to merge ${r.history.pullRequests.medianHoursToMerge === null ? "n/a" : `${r.history.pullRequests.medianHoursToMerge} hours`}.</p>` : ""}${
        r.history.hotspots.length
          ? table(
              ["Hotspot", "Commits", "Churn", "Complexity", "Score"],
              r.history.hotspots.map((h) => [h.path, h.commits, h.churn, h.complexity, h.score]),
            )
          : ""
      }`
    : `<p>Not assessed: ${esc(r.history.reason)}</p>`
}
<h2 id="findings">Findings (${r.findings.length})</h2>
${findings || `<p class="muted">No findings.</p>`}
<h2 id="method">Methodology</h2>
<p>Profile ${esc(r.methodology.profile)} ${esc(r.methodology.scoringVersion)}, hash <code>${esc(r.methodology.profileHash)}</code>. Configuration hash <code>${esc(r.methodology.configHash)}</code>. Glossary ${esc(r.methodology.glossaryVersion)}.</p>
${r.scores
  .map(
    (s) =>
      `<h3>${term(s.dimension)}</h3>${table(
        ["Input", "Raw", "Score", "Weight", "Points to gain", "Available", "Note"],
        s.inputs.map((i) => [
          term(i.name, inputLabel(i.name)),
          i.raw,
          i.normalized,
          i.weight,
          i.impact,
          i.available ? "yes" : "no",
          i.note,
        ]),
        new Set([0]),
      )}`,
  )
  .join("\n")}
<h2 id="glossary">Glossary</h2>
${glossary.map((g) => `<details id="g-${esc(g.id)}"><summary>${esc(g.label)}</summary><p>${esc(g.plain)}</p><p><strong>Technically:</strong> ${esc(g.technical)}</p><p><strong>Why it matters:</strong> ${esc(g.why)}</p><p><strong>How it is calculated:</strong> ${esc(g.calculation)}</p><p><strong>How to improve:</strong> ${esc(g.improve)}</p></details>`).join("\n")}
<h2 id="limits">Limitations</h2>
<ul>${r.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p class="muted">Content hash <code>${esc(r.reproducibility.contentHash)}</code> | tool ${esc(r.reproducibility.toolVersion)} | ${esc(r.reproducibility.finishedAt)}</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>RepoLens report: ${esc(r.repository.name)}</title><style>${CSS}</style></head>
<body><main>${body}</main></body></html>
`;
}
