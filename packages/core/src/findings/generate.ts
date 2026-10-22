import type { AnalysisConfig } from "../config/config.js";
import type {
  DetectionSummary,
  FileRecord,
  Finding,
  GraphModel,
  HistorySummary,
  Metrics,
  PracticesSummary,
  Dependency,
} from "../ir/types.js";
import { makeFinding } from "./make.js";

export interface FindingInputs {
  config: AnalysisConfig;
  files: FileRecord[];
  graph: GraphModel;
  unresolved: Dependency[];
  metrics: Metrics;
  practices: PracticesSummary;
  detection: DetectionSummary;
  history: HistorySummary;
  languages: { language: string; codeLines: number; supportLevel: number }[];
  parseErrors: { path: string; message: string }[];
  truncated: boolean;
}

export const THRESHOLDS = {
  fanOutFile: 20,
  largeFileCodeLines: 1000,
  duplicationMedium: 0.1,
  duplicationLow: 0.05,
  hotspotScore: 50,
  singleAuthorShare: 0.8,
  unresolvedRatio: 0.05,
} as const;

const LOW_COVERAGE_NOTE = "Thresholds are conventions, not universal limits.";

export function generateFindings(inp: FindingInputs): Finding[] {
  const out: Finding[] = [];
  const { graph, metrics, practices, history } = inp;
  const resolutionConfidence =
    graph.resolution.ratio === null || graph.resolution.ratio >= 0.9 ? "high" : "medium";

  for (const c of graph.cycles.filter((x) => x.scope === "file")) {
    out.push(
      makeFinding({
        prefix: "ARCH-CYCLE",
        key: c.members.join("|"),
        ruleId: "arch.cycle.file",
        category: "architecture",
        title: `Circular dependency among ${c.size} files`,
        severity: c.typeOnly ? "low" : "medium",
        confidence: resolutionConfidence,
        explanation: `${c.members.slice(0, 6).join(", ")}${c.size > 6 ? `, and ${c.size - 6} more` : ""} import each other in a cycle.${c.typeOnly ? " The cycle consists only of type-only imports, so it has no runtime effect." : ""}`,
        evidence: [
          {
            kind: "graph-path",
            refs: c.members,
            note: "Members of a strongly connected component in the file import graph",
          },
        ],
        locations: c.members.slice(0, 5).map((p) => ({ path: p, startLine: null, endLine: null })),
        remediation:
          "Move the shared declarations to a module that both sides import, or invert one dependency.",
        limitations: [
          "Only statically resolved imports are included.",
          "A listed cycle may include indirect paths through several files.",
        ],
        tags: ["coupling"],
      }),
    );
  }
  for (const c of graph.cycles.filter((x) => x.scope === "module")) {
    out.push(
      makeFinding({
        prefix: "ARCH-MODCYCLE",
        key: c.members.join("|"),
        ruleId: "arch.cycle.module",
        category: "architecture",
        title: `Circular dependency among ${c.size} modules`,
        severity: "medium",
        confidence: resolutionConfidence,
        explanation: `Modules ${c.members.join(", ")} depend on each other. Module boundaries are derived from directory structure, so this is an observed dependency pattern, not a statement about intended design.`,
        evidence: [
          {
            kind: "graph-path",
            refs: c.members,
            note: "Strongly connected component in the module graph",
          },
        ],
        locations: c.members.map((p) => ({ path: p, startLine: null, endLine: null })),
        remediation:
          "Decide which module owns the shared concept and make the other depend on it only.",
        limitations: ["Module boundaries are inferred from directories."],
        tags: ["coupling", "modules"],
      }),
    );
  }
  if (
    graph.resolution.internalImports >= 10 &&
    graph.resolution.unresolved / graph.resolution.internalImports > THRESHOLDS.unresolvedRatio
  ) {
    out.push(
      makeFinding({
        prefix: "ANALYSIS-UNRESOLVED",
        key: "unresolved",
        ruleId: "analysis.unresolved-imports",
        category: "analysis",
        title: `${graph.resolution.unresolved} internal imports could not be resolved`,
        severity: "low",
        confidence: "high",
        explanation:
          "Imports that point into the repository but did not resolve to a file reduce the reliability of the dependency graph, cycles, and coupling metrics. They may be broken imports, generated files, or an alias the analyzer cannot see.",
        evidence: [
          {
            kind: "metric",
            refs: inp.unresolved.slice(0, 10).map((u) => `${u.fromPath}:${u.line}`),
            note: `${graph.resolution.unresolved} of ${graph.resolution.internalImports} internal imports`,
          },
        ],
        locations: inp.unresolved
          .slice(0, 10)
          .map((u) => ({ path: u.fromPath, startLine: u.line, endLine: u.line })),
        remediation:
          "Fix broken imports, add the missing tsconfig paths, or include generated sources in the analysis.",
        limitations: ["Some unresolved imports may be intentional (generated at build time)."],
        tags: ["reliability"],
      }),
    );
  }
  for (const n of graph.nodes.filter((x) => x.fanOut > THRESHOLDS.fanOutFile)) {
    out.push(
      makeFinding({
        prefix: "ARCH-FANOUT",
        key: n.path,
        ruleId: "arch.high-fan-out",
        category: "architecture",
        title: `${n.path} depends on ${n.fanOut} other files`,
        severity: "low",
        confidence: resolutionConfidence,
        explanation: `A file that imports many other files is sensitive to changes across the codebase. ${LOW_COVERAGE_NOTE}`,
        evidence: [{ kind: "metric", refs: [n.path], note: `fanOut=${n.fanOut}` }],
        locations: [{ path: n.path, startLine: null, endLine: null }],
        remediation:
          "Split the file by responsibility or introduce a facade for the group of imports.",
        limitations: [`Threshold ${THRESHOLDS.fanOutFile} is a convention.`],
        tags: ["coupling"],
      }),
    );
  }
  if (
    graph.entrypointReachable.analyzable &&
    (graph.entrypointReachable.unreachableFiles ?? 0) > 0
  ) {
    const reachable = new Set<string>();
    const idToPath = new Map(graph.nodes.map((n) => [n.id, n.path]));
    const entry = new Set(inp.detection.entrypoints.map((e) => e.path));
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) (adj.get(e.from) ?? adj.set(e.from, []).get(e.from))?.push(e.to);
    const queue = graph.nodes.filter((n) => entry.has(n.path)).map((n) => n.id);
    for (const q of queue) reachable.add(q);
    while (queue.length > 0)
      for (const w of adj.get(queue.pop() as string) ?? [])
        if (!reachable.has(w)) {
          reachable.add(w);
          queue.push(w);
        }
    const orphans = graph.nodes
      .filter((n) => !reachable.has(n.id) && n.fanIn === 0)
      .map((n) => idToPath.get(n.id) as string)
      .sort();
    if (orphans.length > 0) {
      out.push(
        makeFinding({
          prefix: "ARCH-UNREACHED",
          key: orphans.join("|"),
          ruleId: "arch.unreachable-files",
          category: "architecture",
          title: `${orphans.length} source files are not imported and not reachable from detected entrypoints`,
          severity: "info",
          confidence: "low",
          explanation:
            "These files are not referenced by any analyzed file. They may be dead code, but they may also be loaded by a framework convention, a build tool, or a dynamic import.",
          evidence: [
            {
              kind: "metric",
              refs: orphans.slice(0, 20),
              note: "No incoming edges and no path from an entrypoint",
            },
          ],
          locations: orphans.slice(0, 20).map((p) => ({ path: p, startLine: null, endLine: null })),
          remediation: "Confirm whether each file is used. Remove it if it is not.",
          limitations: [
            "Entrypoints are detected from manifests and naming conventions, so the list may be incomplete.",
            "Framework conventions such as file-system routing are not modeled.",
          ],
          tags: ["dead-code-signal"],
        }),
      );
    }
  }

  const high = inp.config.complexity.high;
  const veryHigh = inp.config.complexity.veryHigh;
  const testPaths = new Set(inp.files.filter((f) => f.kind === "test").map((f) => f.path));
  for (const f of metrics.topFunctions
    .filter((x) => x.complexity > high && !testPaths.has(x.path))
    .slice(0, 10)) {
    out.push(
      makeFinding({
        prefix: "QUAL-COMPLEXITY",
        key: `${f.path}:${f.name}:${f.line}`,
        ruleId: "quality.function-complexity",
        category: "quality",
        title: `Function ${f.name} has complexity ${f.complexity}`,
        severity: f.complexity > veryHigh ? "high" : "medium",
        confidence: f.approximate ? "medium" : "high",
        explanation: `${f.name} contains ${f.complexity} decision paths. High complexity makes a function harder to test and change.`,
        evidence: [
          {
            kind: "metric",
            refs: [f.path],
            note: `complexity=${f.complexity}${f.approximate ? " (approximate)" : ""}`,
          },
        ],
        locations: [{ path: f.path, startLine: f.line, endLine: f.endLine }],
        remediation: "Extract independent branches into named functions and cover each with tests.",
        limitations: [
          `Thresholds ${high} and ${veryHigh} are conventions.`,
          ...(f.approximate ? ["The value is approximated from decision keywords."] : []),
        ],
        tags: ["complexity"],
      }),
    );
  }
  const dup = metrics.duplication;
  if (dup.assessed && dup.ratio !== null && dup.ratio >= THRESHOLDS.duplicationLow) {
    out.push(
      makeFinding({
        prefix: "QUAL-DUP",
        key: "repo",
        ruleId: "quality.duplication",
        category: "quality",
        title: `${Math.round(dup.ratio * 1000) / 10} percent of source lines are duplicated`,
        severity: dup.ratio >= THRESHOLDS.duplicationMedium ? "medium" : "low",
        confidence: "medium",
        explanation: "Duplicated blocks must be fixed in several places and tend to drift apart.",
        evidence: [
          {
            kind: "metric",
            refs: dup.groups
              .slice(0, 5)
              .flatMap((g) => g.occurrences.map((o) => `${o.path}:${o.startLine}-${o.endLine}`)),
            note: `${dup.duplicatedLines} of ${dup.totalLines} normalized lines`,
          },
        ],
        locations: dup.groups
          .slice(0, 5)
          .flatMap((g) =>
            g.occurrences
              .slice(0, 2)
              .map((o) => ({ path: o.path, startLine: o.startLine, endLine: o.endLine })),
          ),
        remediation:
          "Extract the repeated blocks into shared functions where they represent the same concept.",
        limitations: [
          "Detection compares normalized lines, so structural clones with renamed identifiers are not found.",
          "Some duplication (generated-like tables, test setup) is harmless.",
        ],
        tags: ["duplication"],
      }),
    );
  }
  const large = metrics.files
    .filter((f) => f.codeLines > THRESHOLDS.largeFileCodeLines && !testPaths.has(f.path))
    .sort((a, b) => b.codeLines - a.codeLines)
    .slice(0, 10);
  for (const f of large) {
    out.push(
      makeFinding({
        prefix: "QUAL-LARGE",
        key: f.path,
        ruleId: "quality.large-file",
        category: "quality",
        title: `${f.path} has ${f.codeLines} code lines`,
        severity: "low",
        confidence: "high",
        explanation: "Very large files usually mix responsibilities and are hard to review.",
        evidence: [{ kind: "metric", refs: [f.path], note: `codeLines=${f.codeLines}` }],
        locations: [{ path: f.path, startLine: null, endLine: null }],
        remediation: "Split the file along responsibilities.",
        limitations: [`Threshold ${THRESHOLDS.largeFileCodeLines} is a convention.`],
        tags: ["size"],
      }),
    );
  }
  if (inp.parseErrors.length > 0) {
    out.push(
      makeFinding({
        prefix: "ANALYSIS-SYNTAX",
        key: inp.parseErrors.map((p) => p.path).join("|"),
        ruleId: "analysis.parse-errors",
        category: "analysis",
        title: `${inp.parseErrors.length} files could not be fully parsed`,
        severity: "info",
        confidence: "high",
        explanation:
          "These files contain syntax the analyzer could not parse completely, so their dependencies and metrics may be incomplete.",
        evidence: [
          {
            kind: "tool-output",
            refs: inp.parseErrors.slice(0, 10).map((p) => p.path),
            note: inp.parseErrors[0]?.message ?? null,
          },
        ],
        locations: inp.parseErrors
          .slice(0, 10)
          .map((p) => ({ path: p.path, startLine: null, endLine: null })),
        remediation: "Check the files for syntax errors or unsupported syntax.",
        limitations: ["The analyzer reports the first diagnostics only."],
        tags: ["reliability"],
      }),
    );
  }
  const totalCode = inp.languages.reduce((s, l) => s + l.codeLines, 0);
  const uncovered = inp.languages.filter(
    (l) => l.supportLevel === 1 && totalCode > 0 && l.codeLines / totalCode >= 0.1,
  );
  if (uncovered.length > 0) {
    out.push(
      makeFinding({
        prefix: "ANALYSIS-LANG",
        key: uncovered.map((l) => l.language).join("|"),
        ruleId: "analysis.unsupported-language",
        category: "analysis",
        title: `Dependency analysis is not available for ${uncovered.map((l) => l.language).join(", ")}`,
        severity: "info",
        confidence: "high",
        explanation: `${uncovered.map((l) => `${l.language} (${Math.round((l.codeLines / totalCode) * 100)} percent of code lines)`).join(", ")} only receive detection and line counts. Architecture conclusions cover the other languages only.`,
        evidence: [
          { kind: "metric", refs: uncovered.map((l) => l.language), note: "Support level 1" },
        ],
        locations: [],
        remediation: "No action needed. Contribute an analyzer to extend coverage.",
        limitations: [],
        tags: ["coverage"],
      }),
    );
  }
  if (inp.truncated) {
    out.push(
      makeFinding({
        prefix: "ANALYSIS-TRUNC",
        key: "budget",
        ruleId: "analysis.truncated",
        category: "analysis",
        title: "Analysis stopped at a size budget",
        severity: "medium",
        confidence: "high",
        explanation:
          "The repository exceeded the file or size budget, so only part of it was analyzed. All results describe that part.",
        evidence: [
          {
            kind: "metric",
            refs: [],
            note: `maxFiles=${inp.config.budgets.maxFiles}, maxTotalBytes=${inp.config.budgets.maxTotalBytes}`,
          },
        ],
        locations: [],
        remediation: "Raise the budgets or exclude generated and vendored directories.",
        limitations: [],
        tags: ["coverage"],
      }),
    );
  }

  const note =
    "Absence of a file in the repository root does not prove the practice is missing elsewhere (for example in an organization-level repository).";
  const practice = (
    key: string,
    title: string,
    sev: "medium" | "low" | "info",
    why: string,
    fix: string,
    cat: "practices" | "documentation" = "practices",
  ) =>
    out.push(
      makeFinding({
        prefix: "PRAC",
        key,
        ruleId: `practice.${key}`,
        category: cat,
        title,
        severity: sev,
        confidence: "high",
        explanation: why,
        evidence: [
          { kind: "metric", refs: [], note: "Detected by file and configuration inspection" },
        ],
        locations: [],
        remediation: fix,
        limitations: [note],
        tags: ["practice"],
      }),
    );
  const hasCode = inp.languages.some((l) => l.codeLines > 0);
  if (hasCode) {
    if (practices.ci.providers.length === 0)
      practice(
        "no-ci",
        "No continuous integration configuration found",
        "medium",
        "No CI provider configuration was detected, so builds and tests are not verified automatically.",
        "Add a CI workflow that builds and runs tests on every pull request.",
      );
    if (practices.tests.testFiles === 0)
      practice(
        "no-tests",
        "No test files detected",
        "medium",
        "No files matching common test patterns were found.",
        "Add automated tests for the core behavior.",
      );
    if (practices.quality.linters.length === 0 && practices.quality.formatters.length === 0)
      practice(
        "no-lint",
        "No linter or formatter configuration found",
        "low",
        "No lint or format configuration was detected.",
        "Add a linter and formatter and run them in CI.",
      );
    if (inp.detection.license.file === null)
      practice(
        "no-license",
        "No license file found",
        "medium",
        "Without a license file others have no legal permission to use or contribute to the code.",
        "Add a LICENSE file.",
        "documentation",
      );
    if (practices.documentation.readme.path === null)
      practice(
        "no-readme",
        "No README found",
        "medium",
        "A README is the first place a new reader looks for purpose and setup.",
        "Add a README that explains purpose, install, and usage.",
        "documentation",
      );
    else if (practices.documentation.readme.hasInstall === false)
      practice(
        "readme-no-install",
        "README has no install or setup section",
        "low",
        "The README headings do not mention installation or setup.",
        "Add setup instructions.",
        "documentation",
      );
    if (
      inp.detection.manifests.some((m) => m.endsWith("package.json")) &&
      inp.detection.lockfiles.length === 0
    )
      practice(
        "no-lockfile",
        "No dependency lockfile found",
        "low",
        "Without a lockfile dependency versions are not pinned, builds are less reproducible, and vulnerability matching is not possible.",
        "Commit the lockfile generated by your package manager.",
      );
  }

  if (
    history.available &&
    history.topAuthorShare !== null &&
    (history.commitsAnalyzed ?? 0) >= 20 &&
    history.topAuthorShare >= THRESHOLDS.singleAuthorShare
  ) {
    out.push(
      makeFinding({
        prefix: "HIST-OWNER",
        key: "top-author",
        ruleId: "history.concentrated-ownership",
        category: "history",
        title: `One author made ${Math.round(history.topAuthorShare * 100)} percent of analyzed commits`,
        severity: "info",
        confidence: "medium",
        explanation:
          "Concentrated authorship is a continuity signal (bus factor). It says nothing about code quality.",
        evidence: [
          {
            kind: "metric",
            refs: history.contributors.slice(0, 1).map((c) => c.name),
            note: `${history.commitsAnalyzed} commits analyzed`,
          },
        ],
        locations: [],
        remediation: "Share ownership through reviews and documentation if continuity matters.",
        limitations: history.limitations,
        tags: ["ownership"],
      }),
    );
  }
  for (const h of history.hotspots
    .filter((x) => (x.score ?? 0) >= THRESHOLDS.hotspotScore)
    .slice(0, 5)) {
    out.push(
      makeFinding({
        prefix: "HIST-HOTSPOT",
        key: h.path,
        ruleId: "history.hotspot",
        category: "history",
        title: `${h.path} changes often and is complex`,
        severity: "low",
        confidence: "medium",
        explanation: `${h.path} appears in ${h.commits} commits with ${h.churn} changed lines and a maximum function complexity of ${h.complexity}. Files that are both complex and frequently changed concentrate maintenance cost.`,
        evidence: [
          {
            kind: "metric",
            refs: [h.path],
            note: `commits=${h.commits}, churn=${h.churn}, complexity=${h.complexity}, score=${h.score}`,
          },
        ],
        locations: [{ path: h.path, startLine: null, endLine: null }],
        remediation: "Prioritize refactoring and test coverage here.",
        limitations: history.limitations,
        tags: ["hotspot"],
      }),
    );
  }
  return out;
}
