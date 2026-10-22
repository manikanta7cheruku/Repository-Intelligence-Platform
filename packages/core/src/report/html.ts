import type { Report, Severity } from "../ir/types.js";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const show = (v: unknown): string => (v === null || v === undefined || v === "" ? "n/a" : esc(v));
const pct = (v: number | null): string => (v === null ? "n/a" : `${Math.round(v * 1000) / 10}%`);
const SEV_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const CSS = `
:root{--bg:#fff;--subtle:#f6f7f9;--border:#d5d9e0;--text:#14171f;--muted:#4a5160;--accent:#2457c5;--critical:#b3261e;--high:#c4501b;--medium:#a86f00;--low:#2f6b9a;--info:#5a6272;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--subtle:#151a22;--border:#2a3240;--text:#e6e9ef;--muted:#b4bbc8;--accent:#7aa2ff;--critical:#ff7b72;--high:#f0883e;--medium:#d9a441;--low:#6cb0e8;--info:#98a2b3}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px;border-bottom:1px solid var(--border);padding-bottom:4px}h3{font-size:15px;margin:20px 0 6px}
nav{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0;font-size:13px}a{color:var(--accent)}.muted{color:var(--muted)}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);vertical-align:top}th{background:var(--subtle);font-weight:600}
code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.tag{display:inline-block;border:1px solid currentColor;border-radius:4px;padding:0 6px;font-size:12px;font-weight:600}
.critical{color:var(--critical)}.high{color:var(--high)}.medium{color:var(--medium)}.low{color:var(--low)}.info{color:var(--info)}
.finding{border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin:8px 0}.finding h4{margin:0 0 4px;font-size:14px}
.banner{border:1px solid var(--border);background:var(--subtle);border-radius:6px;padding:8px 12px;margin:8px 0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;

function table(head: string[], rows: unknown[][], raw: Set<number> = new Set()): string {
  if (rows.length === 0) return `<p class="muted">None.</p>`;
  return `<div class="scroll"><table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td>${raw.has(i) ? String(c) : show(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** Self-contained report page. No scripts, no external resources, every value escaped. */
export function toHtml(r: Report, opts: { maxFindings?: number } = {}): string {
  const max = opts.maxFindings ?? 200;
  const dim = (d: string) => d.replace("-", " ").replace(/^./, (c) => c.toUpperCase());
  const sev = (s: Severity) => `<span class="tag ${s}">${SEV_LABEL[s]}</span>`;
  const findings = r.findings
    .slice(0, max)
    .map(
      (f) => `<article class="finding" id="${esc(f.id)}"><h4>${sev(f.severity)} ${esc(f.title)}</h4>
<p class="muted"><code>${esc(f.id)}</code> | Confidence: ${esc(f.confidence)} | Origin: ${esc(f.origin)}${f.classification ? ` | Classification: ${esc(f.classification)}` : ""}</p>
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
  const scoreRows = r.scores.map((s) => [
    dim(s.dimension),
    s.value,
    s.state,
    s.confidence,
    pct(s.coverage),
    s.reason,
  ]);
  const body = `<h1>RepoLens report: ${esc(r.repository.name)}</h1>
<p class="muted">${esc(r.repository.source.type)}: ${esc(r.repository.source.location)} | commit ${show(r.repository.commitSha)} | schema ${esc(r.schemaVersion)}</p>
<p><span class="tag">${esc(r.status)}</span> ${r.repository.analyzedFiles} of ${r.repository.totalFiles} files analyzed</p>
${r.status !== "complete" ? `<p class="banner">This report is partial. See the limitations section for what is missing.</p>` : ""}
<nav aria-label="Sections"><a href="#summary">Summary</a><a href="#scope">Scope</a><a href="#architecture">Architecture</a><a href="#quality">Quality</a><a href="#security">Security</a><a href="#practices">Practices</a><a href="#history">History</a><a href="#findings">Findings</a><a href="#method">Methodology</a><a href="#limits">Limitations</a></nav>
<h2 id="summary">Summary</h2>
<p class="muted">Not assessed means the inputs were missing. It never means zero.</p>
${table(["Dimension", "Score", "State", "Confidence", "Coverage", "Reason"], scoreRows)}
<h3>Recommendations</h3>
${table(
  ["#", "Recommendation", "Effort", "Findings"],
  r.recommendations.slice(0, 10).map((x) => [x.rank, x.title, x.effort, x.findingIds.length]),
)}
<h2 id="scope">Scope and coverage</h2>
${table(
  ["Language", "Files", "Code lines", "Support level", "Analyzer"],
  r.scope.languages.map((l) => [l.language, l.files, l.codeLines, l.supportLevel, l.analyzerId]),
)}
${table(
  ["Analyzer", "Language", "Eligible", "Analyzed", "Coverage"],
  r.coverage.map((c) => [c.analyzerId, c.language, c.filesEligible, c.filesAnalyzed, pct(c.ratio)]),
)}
<h2 id="architecture">Architecture</h2>
<p>Observed from ${r.graph.nodes.length} source files and ${r.graph.edges.length} edges. Import resolution ratio ${pct(r.graph.resolution.ratio)}. Module boundaries are inferred from directories.</p>
${table(
  ["Module", "Files", "Code lines", "Fan-in", "Fan-out", "Instability"],
  r.graph.modules.map((m) => [m.path, m.fileCount, m.loc, m.fanIn, m.fanOut, m.instability]),
)}
<h3>Cycles</h3>
${table(
  ["Scope", "Size", "Type-only", "Members"],
  r.graph.cycles.map((c) => [
    c.scope,
    c.size,
    c.typeOnly ? "yes" : "no",
    c.members.slice(0, 8).join(", "),
  ]),
)}
<h2 id="quality">Code quality</h2>
<p>${r.metrics.totals.codeLines} code lines, ${r.metrics.functionCount} functions measured. ${r.metrics.duplication.assessed ? `Duplication ${pct(r.metrics.duplication.ratio)}.` : `Duplication not assessed (${esc(r.metrics.duplication.reason)}).`}</p>
${table(
  ["Function", "File", "Line", "Complexity"],
  r.metrics.topFunctions
    .slice(0, 10)
    .map((f) => [f.name, f.path, f.line, `${f.complexity}${f.approximate ? " (approx.)" : ""}`]),
)}
<h2 id="security">Security</h2>
<p class="banner">${esc(r.security.statement)}</p>
${table(["Check", "Assessed", "Result or reason"], [["Dependency vulnerabilities (OSV)", r.security.dependencies.assessed ? "yes" : "no", r.security.dependencies.assessed ? `${r.security.dependencies.vulnerabilities} found` : r.security.dependencies.reason], ...r.security.secrets.map((s) => [`Secrets (${s.tool})`, s.assessed ? "yes" : "no", s.assessed ? `${s.findings} possible` : s.reason]), ["GitHub Actions workflows", r.security.workflows.assessed ? "yes" : "no", r.security.workflows.assessed ? `${r.security.workflows.findings} findings` : r.security.workflows.reason]])}
<h2 id="practices">Testing, CI and documentation</h2>
${table(
  ["Area", "Detected"],
  [
    ["CI", r.practices.ci.providers.join(", ")],
    ["Test frameworks", r.practices.tests.frameworks.join(", ")],
    ["Linters", r.practices.quality.linters.join(", ")],
    ["Type checkers", r.practices.quality.typeCheckers.join(", ")],
    ["README", r.practices.documentation.readme.path],
    ["Decision records", r.practices.documentation.adrCount],
  ],
)}
<h2 id="history">Git history</h2>
${
  r.history.available
    ? table(
        ["Hotspot", "Commits", "Churn", "Complexity", "Score"],
        r.history.hotspots.map((h) => [h.path, h.commits, h.churn, h.complexity, h.score]),
      )
    : `<p>Not assessed: ${esc(r.history.reason)}</p>`
}
<h2 id="findings">Findings (${r.findings.length})</h2>
${findings || `<p class="muted">No findings.</p>`}
<h2 id="method">Methodology</h2>
<p>Profile ${esc(r.methodology.profile)} ${esc(r.methodology.scoringVersion)}, hash <code>${esc(r.methodology.profileHash)}</code>. Configuration hash <code>${esc(r.methodology.configHash)}</code>.</p>
${r.scores
  .map(
    (s) =>
      `<h3>${esc(dim(s.dimension))}</h3>${table(
        ["Input", "Raw", "Score", "Weight", "Available", "Note"],
        s.inputs.map((i) => [
          i.name,
          i.raw,
          i.normalized,
          i.weight,
          i.available ? "yes" : "no",
          i.note,
        ]),
      )}`,
  )
  .join("\n")}
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
