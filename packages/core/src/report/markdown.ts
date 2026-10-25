import type { Finding, Report } from "../ir/types.js";
import { GLOSSARY_INDEX } from "../glossary/glossary.js";
import { toMermaid } from "./diagram.js";
import {
  dimLabel,
  glossaryIdsFor,
  improvements,
  inputLabel,
  missingInputs,
  pctText,
} from "./common.js";

/** Neutralizes HTML in untrusted text so Markdown viewers cannot render injected markup. */
const safe = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (v: string | number | null | undefined): string =>
  safe(v === null || v === undefined || v === "" ? "n/a" : String(v))
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
const table = (head: string[], rows: (string | number | null | undefined)[][]): string =>
  rows.length === 0
    ? "_None._\n"
    : `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n")}\n`;
const bullets = (xs: string[]): string[] => xs.map((x) => `- ${safe(x)}`);

function findingBlock(f: Finding): string {
  const loc = safe(
    f.locations
      .slice(0, 5)
      .map((l) => `${l.path}${l.startLine ? `:${l.startLine}` : ""}`)
      .join(", "),
  );
  const ev = safe(
    f.evidence
      .map((e) => `${e.kind}${e.note ? ` (${e.note})` : ""}: ${e.refs.slice(0, 6).join(", ")}`)
      .join("; "),
  );
  return [
    `#### ${safe(f.title)}`,
    `Id: ${f.id} | Severity: ${f.severity} | Confidence: ${f.confidence} | Origin: ${f.origin}${f.classification ? ` | Classification: ${f.classification}` : ""}`,
    "",
    safe(f.explanation),
    "",
    loc ? `- Locations: ${loc}` : "- Locations: none",
    ev ? `- Evidence: ${ev}` : "- Evidence: none",
    `- Remediation: ${safe(f.remediation)}`,
    f.limitations.length ? `- Limitations: ${safe(f.limitations.join(" "))}` : "",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function toMarkdown(r: Report, opts: { maxFindings?: number } = {}): string {
  const max = opts.maxFindings ?? 100;
  const out: string[] = [];
  out.push(`# RepoLens report: ${safe(r.repository.name)}`, "");
  out.push(
    `Status: **${r.status}**${r.repository.truncated ? " (truncated by size budget)" : ""}`,
    "",
  );
  out.push(
    table(
      ["Field", "Value"],
      [
        ["Source", `${r.repository.source.type}: ${r.repository.source.location}`],
        ["Ref", r.repository.source.ref],
        ["Commit", r.repository.commitSha],
        [
          "Files",
          `${r.repository.totalFiles} total, ${r.repository.codeFiles} code files (${r.repository.productionFiles} production, ${r.repository.testFiles} test), ${r.repository.analyzedCodeFiles} code files analyzed`,
        ],
        ["Schema", r.schemaVersion],
        ["Tool", r.reproducibility.toolVersion],
      ],
    ),
  );

  out.push(
    "## Executive summary",
    "",
    `**${safe(r.executiveSummary.headline)}**`,
    "",
    ...bullets(r.executiveSummary.overview),
    "",
  );
  if (r.executiveSummary.strengths.length > 0)
    out.push("What looks good:", "", ...bullets(r.executiveSummary.strengths), "");
  if (r.executiveSummary.concerns.length > 0)
    out.push("What needs attention:", "", ...bullets(r.executiveSummary.concerns), "");
  if (r.executiveSummary.nextSteps.length > 0)
    out.push(
      "Suggested next steps:",
      "",
      ...r.executiveSummary.nextSteps.map((s, i) => `${i + 1}. ${safe(s)}`),
      "",
    );

  out.push(
    "## Scores",
    "",
    'Each score summarizes named inputs through published curves. Confidence says how much of the code the analysis covered. "Inputs used" is the share of the score\'s building blocks that had data. Not assessed means the inputs were missing, not that the value is zero.',
    "",
  );
  out.push(
    table(
      ["Dimension", "Score", "State", "Confidence", "Coverage", "Inputs used", "Reason"],
      r.scores.map((s) => [
        dimLabel(s.dimension),
        s.value,
        s.state,
        s.confidence,
        pctText(s.coverage),
        pctText(s.weightCoverage),
        s.reason,
      ]),
    ),
  );
  const imp = improvements(r);
  if (imp.length > 0) {
    out.push("### How to improve each score", "");
    out.push(
      table(
        ["Dimension", "Input", "Now (0 to 100)", "Points to gain", "What to do"],
        imp.map((i) => [
          dimLabel(i.dimension),
          i.label,
          i.currentScore,
          `up to ${i.gain}`,
          i.advice,
        ]),
      ),
    );
  }
  for (const s of r.scores.filter((x) => x.state === "not-assessed"))
    out.push(
      `- ${dimLabel(s.dimension)} is not assessed. To enable it: ${safe(missingInputs(s).join("; "))}.`,
    );
  out.push("");
  out.push("### Top recommendations", "");
  out.push(
    table(
      ["#", "Recommendation", "Effort", "Findings"],
      r.recommendations.slice(0, 8).map((x) => [x.rank, x.title, x.effort, x.findingIds.length]),
    ),
  );

  out.push("## Scope and coverage", "");
  out.push(
    table(
      ["Language", "Files", "Code lines", "Support level", "Analyzer"],
      r.scope.languages.map((l) => [
        l.language,
        l.files,
        l.codeLines,
        l.supportLevel,
        l.analyzerId ?? "none (detection only)",
      ]),
    ),
  );
  out.push(
    table(
      ["Analyzer", "Language", "Eligible files", "Analyzed", "Coverage"],
      r.coverage.map((c) => [
        c.analyzerId,
        c.language,
        c.filesEligible,
        c.filesAnalyzed,
        c.supportLevel === 1 ? "n/a (detection only)" : pctText(c.ratio),
      ]),
    ),
  );
  out.push("### Project detection", "");
  out.push(
    table(
      ["Field", "Value"],
      [
        ["Package managers", r.detection.packageManagers.join(", ")],
        ["Frameworks", r.detection.frameworks.map((f) => f.name).join(", ")],
        ["Runtimes", r.detection.runtimes.join(", ")],
        ["Build tools", r.detection.buildTools.join(", ")],
        ["Entrypoints", r.detection.entrypoints.map((e) => e.path).join(", ")],
        ["License", r.detection.license.spdxGuess ?? r.detection.license.file],
      ],
    ),
  );

  out.push("## Architecture", "");
  out.push(
    `Observed from ${r.graph.nodes.length} source files and ${r.graph.edges.length} dependency edges. Import resolution: ${r.graph.resolution.resolved} resolved, ${r.graph.resolution.unresolved} unresolved, ${r.graph.resolution.external} external, ratio ${pctText(r.graph.resolution.ratio)}. Module boundaries are inferred from directories.`,
    "",
  );
  if (r.graph.modules.length > 0) out.push("```mermaid", toMermaid(r).trimEnd(), "```", "");
  out.push(
    table(
      ["Module", "Files", "Code lines", "Fan-in", "Fan-out", "Instability"],
      r.graph.modules.map((m) => [m.path, m.fileCount, m.loc, m.fanIn, m.fanOut, m.instability]),
    ),
  );
  const lv = new Map(r.graph.levels.map((l) => [l.moduleId, l.level]));
  const byLevel = [...lv.entries()]
    .map(([id, level]) => ({ level, path: r.graph.modules.find((m) => m.id === id)?.path ?? id }))
    .sort((a, b) => b.level - a.level || a.path.localeCompare(b.path));
  out.push(
    "Inferred dependency levels (0 depends on no other module, higher levels depend on lower ones). Confidence is low or medium because levels are derived from the graph, not from documentation.",
    "",
  );
  out.push(
    table(
      ["Level", "Module"],
      byLevel.map((l) => [l.level, l.path]),
    ),
  );
  out.push("### Circular dependencies", "");
  out.push(
    r.graph.cycles.length === 0
      ? "None found.\n"
      : table(
          ["Scope", "Size", "Type-only", "Members"],
          r.graph.cycles.map((c) => [
            c.scope,
            c.size,
            c.typeOnly ? "yes" : "no",
            c.members.slice(0, 8).join(", "),
          ]),
        ),
  );

  out.push("## Risk and blast radius", "");
  if (r.risk.assessed) {
    out.push(safe(r.risk.method), "");
    out.push(
      table(
        ["File", "Risk (0 to 100)", "Confidence", "Why"],
        r.risk.files
          .slice(0, 10)
          .map((f) => [
            f.path,
            f.risk,
            f.confidence,
            f.drivers.join("; ") || "blend of moderate signals",
          ]),
      ),
    );
  } else out.push(`Risk index not assessed: ${safe(r.risk.reason ?? "")}`, "");
  out.push(
    "Blast radius: what could be affected if a file changes (files that import it directly or indirectly, plus the modules and entrypoints they belong to).",
    "",
  );
  out.push(
    table(
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
    ),
  );

  out.push("## Code quality", "");
  out.push(
    `Totals: ${r.metrics.totals.codeLines} code lines, ${r.metrics.totals.commentLines} comment lines, ${r.metrics.totals.blankLines} blank lines. Functions measured: ${r.metrics.functionCount}.`,
    "",
  );
  const dup = r.metrics.duplication;
  out.push(
    dup.assessed
      ? `Duplication: ${pctText(dup.ratio)} (${dup.duplicatedLines} of ${dup.totalLines} normalized lines).`
      : `Duplication: not assessed (${safe(dup.reason ?? "")}).`,
    "",
  );
  out.push(
    table(
      ["Function", "File", "Line", "Complexity"],
      r.metrics.topFunctions
        .slice(0, 10)
        .map((f) => [
          f.name,
          f.path,
          f.line,
          `${f.complexity}${f.approximate ? " (approx.)" : ""}`,
        ]),
    ),
  );

  out.push("## Security", "", safe(r.security.statement), "");
  out.push(
    table(
      ["Check", "Assessed", "Result or reason"],
      [
        [
          "Dependency vulnerabilities (OSV)",
          r.security.dependencies.assessed ? "yes" : "no",
          r.security.dependencies.assessed
            ? `${r.security.dependencies.vulnerabilities} advisories across ${r.security.dependencies.packagesChecked} packages checked`
            : r.security.dependencies.reason,
        ],
        ...r.security.secrets.map((s) => [
          `Secrets (${s.tool})`,
          s.assessed ? "yes" : "no",
          s.assessed ? `${s.findings} possible secrets. ${s.reason ?? ""}` : s.reason,
        ]),
        [
          "GitHub Actions workflows",
          r.security.workflows.assessed ? "yes" : "no",
          r.security.workflows.assessed
            ? `${r.security.workflows.findings} findings`
            : r.security.workflows.reason,
        ],
      ],
    ),
  );

  out.push("## Testing, CI and documentation", "");
  const p = r.practices;
  out.push(
    table(
      ["Area", "Detected"],
      [
        ["CI", p.ci.providers.join(", ")],
        ["Test frameworks", p.tests.frameworks.join(", ")],
        ["Test files and source files", `${p.tests.testFiles} test, ${p.tests.sourceFiles} source`],
        [
          "Test coverage",
          r.testCoverage.ingested
            ? `${pctText(r.testCoverage.lineRate)} from ${r.testCoverage.source} (${r.testCoverage.filesMatched} files matched)`
            : `not ingested: ${r.testCoverage.reason}`,
        ],
        ["Linters", p.quality.linters.join(", ")],
        ["Formatters", p.quality.formatters.join(", ")],
        ["Type checkers", p.quality.typeCheckers.join(", ")],
        [
          "README",
          p.documentation.readme.path
            ? `${p.documentation.readme.words} words, sections: ${p.documentation.readme.sections.join(", ") || "none"}`
            : "none",
        ],
        ["Decision records", p.documentation.adrCount],
      ],
    ),
  );

  out.push("## Git history", "");
  if (r.history.available) {
    const h = r.history;
    out.push(
      `${h.commitsAnalyzed} commits analyzed (${h.source === "github-api" ? "sample from the GitHub API" : "local Git"})${h.shallow ? ", shallow clone" : ""}.`,
      "",
    );
    if (h.commitQuality)
      out.push(
        `Commit messages (signal, not a verdict): ${pctText(h.commitQuality.conventionalShare)} follow Conventional Commits, ${pctText(h.commitQuality.descriptiveShare)} are descriptive, ${pctText(h.commitQuality.genericShare)} are generic.`,
        "",
      );
    if (h.pullRequests)
      out.push(
        `Pull requests (recent sample of ${h.pullRequests.sampled} closed): ${h.pullRequests.merged} merged, median time to merge ${h.pullRequests.medianHoursToMerge === null ? "n/a" : `${h.pullRequests.medianHoursToMerge} hours`}.`,
        "",
      );
    if (h.releases)
      out.push(
        `Releases: ${h.releases.count}${h.releases.latestDate ? `, latest ${h.releases.latestDate.slice(0, 10)}` : ""}.`,
        "",
      );
    if (h.hotspots.length > 0)
      out.push(
        table(
          ["Hotspot", "Commits", "Churn", "Complexity", "Score"],
          h.hotspots.map((x) => [x.path, x.commits, x.churn, x.complexity, x.score]),
        ),
      );
    out.push(
      table(
        ["Contributor", "Commits", "Share"],
        h.contributors.slice(0, 8).map((c) => [c.name, c.commits, pctText(c.share)]),
      ),
    );
  } else out.push(`Not assessed: ${safe(r.history.reason ?? "")}`, "");

  out.push("## Architecture rules", "");
  out.push(
    r.rules.evaluated
      ? `Rules from ${r.rules.source}: ${r.rules.violations} violations${r.rules.baseline ? `, ${r.rules.baseline.suppressed} suppressed by baseline` : ""}.`
      : "No rules file supplied, so conformance was not evaluated. Add repolens.rules.yaml to enable it.",
    "",
  );

  out.push("## Findings", "");
  out.push(
    `${r.findings.length} findings.${r.findings.length > max ? ` Showing the first ${max}.` : ""}`,
    "",
  );
  for (const f of r.findings.slice(0, max)) out.push(findingBlock(f));

  out.push(
    "## Methodology",
    "",
    `Scoring profile ${r.methodology.profile} version ${r.methodology.scoringVersion} (hash ${r.methodology.profileHash}). Configuration hash ${r.methodology.configHash}. Glossary version ${r.methodology.glossaryVersion}.`,
    "",
  );
  for (const s of r.scores) {
    out.push(`### ${dimLabel(s.dimension)}`, "");
    out.push(
      table(
        ["Input", "Raw", "Score", "Weight", "Points to gain", "Available", "Note"],
        s.inputs.map((i) => [
          inputLabel(i.name),
          i.raw,
          i.normalized,
          i.weight,
          i.impact,
          i.available ? "yes" : "no",
          i.note,
        ]),
      ),
    );
  }

  out.push("## Glossary", "");
  out.push(
    table(
      ["Term", "Meaning", "Why it matters"],
      glossaryIdsFor(r)
        .map((id) => GLOSSARY_INDEX.get(id))
        .filter((g): g is NonNullable<typeof g> => g !== undefined)
        .map((g) => [g.label, g.plain, g.why]),
    ),
  );
  out.push("## Limitations", "");
  for (const l of r.limitations) out.push(`- ${safe(l)}`);
  out.push("", "## Reproducibility", "");
  out.push(
    table(
      ["Field", "Value"],
      [
        ["Content hash", r.reproducibility.contentHash],
        ["Input digest", r.reproducibility.inputDigest],
        ["Commit", r.reproducibility.commitSha],
        ["Started", r.reproducibility.startedAt],
        ["Finished", r.reproducibility.finishedAt],
        ["Node", r.reproducibility.toolVersions.node],
        ["TypeScript", r.reproducibility.toolVersions.typescript],
      ],
    ),
  );
  return `${out.join("\n")}\n`;
}
