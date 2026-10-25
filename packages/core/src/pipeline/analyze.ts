import { basename } from "node:path";
import type { Workspace } from "../acquire/types.js";
import { DEFAULT_ANALYZERS } from "../analyzers/registry.js";
import type { AnalyzerPlugin, FileAnalysis } from "../analyzers/types.js";
import { type AnalysisConfig, configHash } from "../config/config.js";
import { languageOf } from "../detect/languages.js";
import { detectProject } from "../detect/manifests.js";
import { generateFindings } from "../findings/generate.js";
import { sortFindings } from "../findings/make.js";
import { fetchGitHubActivity, type JsonFetch } from "../git/activity.js";
import { collectHistory, type RepoHead, readHead, unavailable } from "../git/history.js";
import { GLOSSARY_VERSION } from "../glossary/glossary.js";
import { buildGraph, moduleOf } from "../graph/build.js";
import { computeBlastRadius } from "../graph/impact.js";
import type {
  CoverageRecord,
  Dependency,
  FileKind,
  FileMetrics,
  FileRecord,
  Finding,
  FunctionMetric,
  HistorySummary,
  Metrics,
  Report,
  SecuritySummary,
  SupportLevel,
} from "../ir/types.js";
import { REPORT_SCHEMA_VERSION } from "../ir/types.js";
import { ingestCoverage } from "../metrics/coverage.js";
import { detectDuplication } from "../metrics/duplication.js";
import { countLines } from "../metrics/loc.js";
import { detectPractices } from "../practices/detect.js";
import { buildExecutiveSummary } from "../report/summary.js";
import { computeRisk } from "../risk/risk.js";
import { applyBaseline, evaluateRules, parseBaseline, parseRules } from "../rules/engine.js";
import { DEFAULT_PROFILE, profileHash } from "../scoring/profile.js";
import { buildRecommendations } from "../scoring/recommend.js";
import { computeScores } from "../scoring/score.js";
import { extractPackages, type OsvFetch, queryOsv } from "../security/osv.js";
import { runGitleaks, scanSecretsBuiltin } from "../security/secrets.js";
import { checkWorkflows } from "../security/workflows.js";
import { sha256, stableStringify } from "../util/hash.js";
import { dirname } from "../util/paths.js";
import { classifyFiles } from "./files.js";

export const TOOL_VERSION = "0.1.0";

export type Stage =
  | "detecting"
  | "analyzing"
  | "graph"
  | "metrics"
  | "rules"
  | "history"
  | "security"
  | "practices"
  | "scoring"
  | "reporting";

export interface AnalyzeOptions {
  config: AnalysisConfig;
  workspace: Workspace;
  source: { type: "local" | "github"; location: string; ref: string | null; name?: string };
  /** Commit known from acquisition (for archives). Overridden by Git when available. */
  commitSha?: string | null;
  /** Directory to read Git history from. Null disables history. */
  historyRoot?: string | null;
  rules?: { text: string; name: string } | null;
  baseline?: { text: string } | null;
  analyzers?: AnalyzerPlugin[];
  onProgress?: (stage: Stage, detail?: string) => void;
  signal?: AbortSignal;
  osvFetch?: OsvFetch;
  /** Supplied coverage report text (lcov, Istanbul summary or Cobertura XML). */
  coverage?: { name: string; text: string } | null;
  /** For GitHub targets without a clone: fetch commit, pull request and release signals from the API. */
  activity?: {
    owner: string;
    repo: string;
    ref: string | null;
    token?: string | undefined;
    fetchImpl?: JsonFetch | undefined;
  } | null;
  now?: () => Date;
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

export async function analyze(opts: AnalyzeOptions): Promise<Report> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const { config, workspace: ws } = opts;
  const progress = opts.onProgress ?? (() => undefined);
  const analyzers = opts.analyzers ?? DEFAULT_ANALYZERS;
  const limitations: string[] = [
    "Static analysis cannot recover runtime behavior, developer intent, or undocumented design decisions.",
    "A report with no findings in an area does not prove that area is sound or secure.",
    ...ws.limitations,
  ];
  let partial = ws.truncated;

  // Parse user supplied rules first so a broken rules file fails fast, before any heavy work.
  const ruleSet = opts.rules ? parseRules(opts.rules.text, opts.rules.name) : null;
  const baseline = opts.baseline ? parseBaseline(opts.baseline.text) : null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.budgets.analysisTimeoutMs);
  const onAbort = () => controller.abort();
  if (opts.signal?.aborted) controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  const signal = controller.signal;

  try {
    // 1. Files and detection
    progress("detecting", `${ws.files.length} files`);
    const { files, texts } = classifyFiles(ws, config);
    const detection = detectProject(ws);

    // 2. Language analyzers (isolated: one failure never aborts the run)
    progress("analyzing");
    const byPath = new Map(files.map((f) => [f.path, f]));
    const allPaths = new Set(files.map((f) => f.path));
    const analyses = new Map<string, FileAnalysis>();
    const coverage: CoverageRecord[] = [];
    const supportByLanguage = new Map<string, { level: SupportLevel; analyzerId: string | null }>();
    const eligibleByLanguage = new Map<string, FileRecord[]>();
    for (const f of files) {
      if (
        f.language &&
        (f.kind === "source" || f.kind === "test") &&
        f.notAnalyzedReason === null
      ) {
        (
          eligibleByLanguage.get(f.language) ??
          eligibleByLanguage.set(f.language, []).get(f.language)
        )?.push(f);
      }
    }
    for (const plugin of analyzers) {
      const eligible = plugin.languages.flatMap((l) => eligibleByLanguage.get(l) ?? []);
      for (const l of plugin.languages)
        if (eligibleByLanguage.has(l))
          supportByLanguage.set(l, { level: plugin.supportLevel, analyzerId: plugin.id });
      if (eligible.length === 0) continue;
      let analyzerLimitations = plugin.limitations;
      try {
        const result = await plugin.analyze({
          ws,
          config,
          allPaths,
          signal,
          files: eligible.map((f) => ({ path: f.path, language: f.language as string, id: f.id })),
        });
        analyzerLimitations = result.limitations;
        for (const fa of result.files) {
          analyses.set(fa.path, fa);
          const rec = byPath.get(fa.path);
          if (rec) {
            const unreadable = fa.parseError?.startsWith("file unreadable");
            rec.analyzed = !unreadable;
            if (unreadable) rec.notAnalyzedReason = fa.parseError;
          }
        }
      } catch (e) {
        partial = true;
        limitations.push(
          `Analyzer ${plugin.id} failed: ${(e as Error).message}. Its languages are reported with detection and line counts only.`,
        );
        for (const l of plugin.languages) supportByLanguage.set(l, { level: 1, analyzerId: null });
      }
      for (const l of plugin.languages) {
        const el = eligibleByLanguage.get(l) ?? [];
        if (el.length === 0) continue;
        const done = el.filter((f) => f.analyzed).length;
        coverage.push({
          analyzerId: plugin.id,
          language: l,
          supportLevel: supportByLanguage.get(l)?.level ?? 1,
          filesEligible: el.length,
          filesAnalyzed: done,
          ratio: round4(done / el.length),
          limitations: analyzerLimitations,
        });
      }
    }
    for (const [lang, el] of eligibleByLanguage) {
      if (supportByLanguage.has(lang)) continue;
      supportByLanguage.set(lang, { level: 1, analyzerId: null });
      coverage.push({
        analyzerId: "generic",
        language: lang,
        supportLevel: 1,
        filesEligible: el.length,
        filesAnalyzed: 0,
        ratio: 0,
        limitations: [
          "Level 1: file detection and line counts only. No dependency, symbol or complexity analysis.",
        ],
      });
      for (const f of el) f.notAnalyzedReason ??= `no analyzer for ${lang} (support level 1)`;
    }
    coverage.sort((a, b) => a.language.localeCompare(b.language));
    const parseErrors: { path: string; message: string }[] = [];
    for (const [p, a] of analyses)
      if (a.parseError && !a.parseError.startsWith("file unreadable"))
        parseErrors.push({ path: p, message: a.parseError });
    parseErrors.sort((a, b) => a.path.localeCompare(b.path));

    // 3. Graph (production source only)
    progress("graph");
    const graphFiles = files.filter((f) => f.kind === "source" && f.analyzed);
    const graphSet = new Set(graphFiles.map((f) => f.path));
    const allDeps: Dependency[] = [];
    for (const [p, a] of analyses) if (graphSet.has(p)) allDeps.push(...a.dependencies);
    const packageDirs = detection.manifests
      .filter((m) => /(^|\/)(package\.json|pyproject\.toml|setup\.py)$/.test(m))
      .map(dirname);
    const { graph, externals, unresolved } = buildGraph({
      files: graphFiles,
      dependencies: allDeps,
      packageDirs,
      entrypoints: detection.entrypoints.map((e) => e.path),
      config,
    });

    // 4. Metrics
    progress("metrics");
    const fileMetrics: FileMetrics[] = [];
    const fnMetrics: FunctionMetric[] = [];
    const totals = { codeLines: 0, commentLines: 0, blankLines: 0 };
    for (const f of files) {
      if (f.lines === null || f.language === null || (f.kind !== "source" && f.kind !== "test"))
        continue;
      const text = texts.get(f.path);
      if (text === undefined) continue;
      const c = countLines(text, f.language);
      const fa = analyses.get(f.path);
      const fns = fa?.functions ?? [];
      const complexities = fns.map((x) => x.complexity);
      fileMetrics.push({
        fileId: f.id,
        path: f.path,
        codeLines: c.code,
        commentLines: c.comment,
        blankLines: c.blank,
        functions: fns.length,
        maxComplexity:
          fa && f.analyzed ? (complexities.length > 0 ? Math.max(...complexities) : 0) : null,
        totalComplexity: fa && f.analyzed ? complexities.reduce((s, x) => s + x, 0) : null,
      });
      totals.codeLines += c.code;
      totals.commentLines += c.comment;
      totals.blankLines += c.blank;
      for (const fn of fns) fnMetrics.push({ fileId: f.id, path: f.path, ...fn });
    }
    fileMetrics.sort((a, b) => a.path.localeCompare(b.path));
    fnMetrics.sort(
      (a, b) => b.complexity - a.complexity || a.path.localeCompare(b.path) || a.line - b.line,
    );
    const testSet = new Set(files.filter((f) => f.kind === "test").map((f) => f.path));
    const prodFns = fnMetrics.filter((f) => !testSet.has(f.path));
    const { moderate, high, veryHigh } = config.complexity;
    const distribution =
      prodFns.length === 0
        ? null
        : {
            low: prodFns.filter((f) => f.complexity <= moderate).length,
            moderate: prodFns.filter((f) => f.complexity > moderate && f.complexity <= high).length,
            high: prodFns.filter((f) => f.complexity > high && f.complexity <= veryHigh).length,
            veryHigh: prodFns.filter((f) => f.complexity > veryHigh).length,
          };
    const dupFiles = files.filter(
      (f) =>
        texts.has(f.path) &&
        f.language !== null &&
        (f.kind === "source" || (config.duplication.includeTests && f.kind === "test")),
    );
    const duplication = config.duplication.enabled
      ? detectDuplication(
          dupFiles.map((f) => ({
            path: f.path,
            text: texts.get(f.path) as string,
            language: f.language,
          })),
          config,
        )
      : {
          assessed: false,
          reason: "Disabled by configuration",
          duplicatedLines: null,
          totalLines: null,
          ratio: null,
          groups: [],
        };
    const metrics: Metrics = {
      files: fileMetrics,
      topFunctions: fnMetrics.slice(0, 25),
      functionCount: fnMetrics.length,
      complexityDistribution: distribution,
      duplication,
      totals,
    };

    // 5. Rules
    progress("rules");
    let ruleFindings: Finding[] = [];
    let suppressed = 0;
    if (ruleSet) {
      const externalsByFile = new Map<string, { pkg: string; line: number }[]>();
      for (const d of allDeps) {
        if (d.resolution === "external" && d.externalPackage && !d.builtin) {
          (
            externalsByFile.get(d.fromPath) ?? externalsByFile.set(d.fromPath, []).get(d.fromPath)
          )?.push({ pkg: d.externalPackage, line: d.line });
        }
      }
      ruleFindings = evaluateRules(ruleSet, {
        graph,
        externalsByFile,
        fileCodeLines: new Map(
          fileMetrics.filter((m) => !testSet.has(m.path)).map((m) => [m.path, m.codeLines]),
        ),
        functions: prodFns.map((f) => ({
          path: f.path,
          name: f.name,
          line: f.line,
          complexity: f.complexity,
        })),
      });
    }

    // 6. History (local Git only)
    progress("history");
    let history: HistorySummary;
    let head: RepoHead | null = null;
    const fileStats = new Map<string, { commits: number; churn: number }>();
    const histRoot = opts.historyRoot === undefined ? null : opts.historyRoot;
    if (!config.history.enabled) history = unavailable("Disabled by configuration");
    else if (histRoot === null && opts.activity && !config.security.offline) {
      history = await fetchGitHubActivity(opts.activity, {
        token: opts.activity.token,
        fetchImpl: opts.activity.fetchImpl,
        signal,
        authors: config.history.authors,
      });
    } else if (histRoot === null)
      history = unavailable(
        config.security.offline && opts.activity
          ? "Offline mode: GitHub history needs network access. Analyze a local clone for full history."
          : "No local Git history for this source. Use a local clone, or use a GitHub URL online to get a sample from the GitHub API.",
      );
    else {
      head = await readHead(histRoot, signal);
      if (head === null)
        history = unavailable(
          "Not a Git repository, or Git could not read it (for example unsafe directory ownership)",
        );
      else {
        const complexityByPath = new Map<string, number | null>();
        for (const m of fileMetrics)
          if (graphSet.has(m.path)) complexityByPath.set(m.path, m.maxComplexity);
        const moduleLookup = (p: string) =>
          graphSet.has(p)
            ? (() => {
                const m = moduleOf(p, packageDirs, config.moduleDepth);
                const rec = graph.modules.find((x) => x.path === m.path);
                return rec ? { id: rec.id, path: rec.path } : null;
              })()
            : null;
        history = await collectHistory(
          histRoot,
          head,
          {
            maxCommits: config.history.maxCommits,
            authors: config.history.authors,
            hotspotLimit: config.history.hotspotLimit,
          },
          { files: complexityByPath, moduleOf: moduleLookup, fileStatsSink: fileStats },
          signal,
        );
      }
    }

    // 7. Security
    progress("security");
    const kinds = new Map<string, FileKind>(files.map((f) => [f.path, f.kind]));
    const securityFindings: Finding[] = [];
    let dependencies: SecuritySummary["dependencies"];
    if (!config.security.osv)
      dependencies = {
        assessed: false,
        reason: "Disabled by configuration",
        source: null,
        packagesChecked: null,
        vulnerabilities: null,
      };
    else if (config.security.offline)
      dependencies = {
        assessed: false,
        reason: "Offline mode: vulnerability lookups need network access",
        source: null,
        packagesChecked: null,
        vulnerabilities: null,
      };
    else {
      const { packages, sources } = extractPackages(ws);
      if (packages.length === 0)
        dependencies = {
          assessed: false,
          reason:
            "No supported lockfile with pinned versions found (package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt with ==, poetry.lock)",
          source: null,
          packagesChecked: null,
          vulnerabilities: null,
        };
      else {
        const r = await queryOsv(packages, {
          signal,
          ...(opts.osvFetch ? { fetchImpl: opts.osvFetch } : {}),
        });
        dependencies = {
          ...r.summary,
          source: r.summary.source ? `${r.summary.source}; lockfiles: ${sources.join(", ")}` : null,
        };
        securityFindings.push(...r.findings);
        if (!r.summary.assessed) {
          partial = true;
          limitations.push(r.summary.reason ?? "OSV lookup failed");
        }
      }
    }
    const secretRuns = [];
    if (config.security.secrets) {
      const builtin = scanSecretsBuiltin(ws, kinds);
      secretRuns.push(builtin.run);
      securityFindings.push(...builtin.findings);
      const gl = await runGitleaks(ws.root, config.security.gitleaksPath, kinds, signal);
      secretRuns.push(gl.run);
      securityFindings.push(...gl.findings);
    } else
      secretRuns.push({
        assessed: false,
        reason: "Disabled by configuration",
        tool: "secrets",
        findings: null,
      });
    let workflows: SecuritySummary["workflows"];
    if (config.security.workflows) {
      const w = checkWorkflows(ws);
      workflows = w.run;
      securityFindings.push(...w.findings);
    } else
      workflows = {
        assessed: false,
        reason: "Disabled by configuration",
        tool: "builtin-workflow-checks",
        findings: null,
      };
    const security: SecuritySummary = {
      dependencies,
      secrets: secretRuns,
      workflows,
      statement:
        "Security results are signals from specific checks. They do not show that the repository is secure. Dynamic behavior, logic flaws and issues outside the listed checks are not assessed.",
    };

    // 8. Practices
    progress("practices");
    const cov = ingestCoverage(ws, allPaths, opts.coverage ?? null);
    const practices = detectPractices(ws, files, detection, cov.summary.ingested);

    // 9. Findings, scores, recommendations
    progress("scoring");
    const languages = [...supportByLanguage.entries()]
      .map(([language, s]) => {
        const fs = files.filter(
          (f) => f.language === language && (f.kind === "source" || f.kind === "test"),
        );
        return {
          language,
          files: fs.length,
          codeLines: fs.reduce((a, f) => a + (f.codeLines ?? 0), 0),
          supportLevel: s.level,
          analyzerId: s.analyzerId,
        };
      })
      .sort((a, b) => b.codeLines - a.codeLines || a.language.localeCompare(b.language));

    const testDirect = new Set<string>();
    for (const f of files) {
      if (f.kind !== "test") continue;
      for (const d of analyses.get(f.path)?.dependencies ?? [])
        if (
          d.resolution === "resolved" &&
          d.toPath &&
          graphSet.has(d.toPath) &&
          d.kind !== "type-only"
        )
          testDirect.add(d.toPath);
    }
    const entrypointPaths = detection.entrypoints.map((e) => e.path);
    const blastRadius = computeBlastRadius(graph, entrypointPaths, 20);
    const risk = computeRisk({
      graph,
      fileMetrics: fileMetrics.filter((m) => graphSet.has(m.path)),
      entrypoints: entrypointPaths,
      fileStats:
        history.available && history.source === "git" && fileStats.size > 0 ? fileStats : null,
      testDirect,
      hasTests: files.some((f) => f.kind === "test"),
      coverage: cov.summary.ingested ? cov.perFile : null,
    });
    const generated = generateFindings({
      config,
      files,
      graph,
      unresolved,
      metrics,
      practices,
      detection,
      history,
      languages,
      parseErrors,
      truncated: ws.truncated,
      risk,
      testCoverage: cov.summary,
    });
    let all = sortFindings([...generated, ...ruleFindings, ...securityFindings]);
    let ruleViolations = ruleFindings.length;
    if (baseline) {
      const applied = applyBaseline(all, baseline);
      suppressed = applied.suppressed;
      ruleViolations = ruleFindings.filter((f) => applied.kept.some((k) => k.id === f.id)).length;
      all = applied.kept;
    }
    const scores = computeScores({
      profile: DEFAULT_PROFILE,
      files,
      graph,
      metrics,
      practices,
      detection,
      history,
      security,
      findings: all,
      rulesEvaluated: ruleSet !== null,
      ruleViolations,
      languages: languages.map((l) => l.language),
      truncated: ws.truncated,
      maxCommits: config.history.maxCommits,
      coverageRate: cov.summary.lineRate,
      languageLevels: languages.map((l) => ({
        language: l.language,
        codeLines: l.codeLines,
        supportLevel: l.supportLevel,
      })),
    });
    const recommendations = buildRecommendations(all);

    // 10. Report
    progress("reporting");
    for (const l of coverage)
      for (const x of l.limitations) if (!limitations.includes(x)) limitations.push(x);
    if (languages.filter((l) => l.supportLevel >= 2).length >= 2)
      limitations.push(
        "Dependencies between different languages (for example a web client calling an API) are not modeled. Each language is analyzed separately.",
      );
    if (risk.assessed) limitations.push(risk.method);
    const unsupported = languages
      .filter((l) => l.supportLevel === 1 && l.codeLines > 0)
      .map((l) => l.language);
    if (unsupported.length > 0)
      limitations.push(
        `Languages with detection and line counts only (support level 1): ${unsupported.join(", ")}.`,
      );
    if (history.available)
      for (const x of history.limitations) if (!limitations.includes(x)) limitations.push(x);
    const commitSha = head?.commitSha ?? opts.commitSha ?? null;
    const excludedList = [...ws.excluded];
    const report: Report = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      status: partial ? "partial" : "complete",
      repository: {
        source: { type: opts.source.type, location: opts.source.location, ref: opts.source.ref },
        name: opts.source.name ?? basename(ws.root),
        commitSha,
        defaultBranch: null,
        totalFiles: files.length,
        analyzedFiles: files.filter((f) => f.analyzed).length,
        totalBytes: files.reduce((s, f) => s + f.bytes, 0),
        truncated: ws.truncated,
        codeFiles: files.filter(
          (f) => f.language !== null && (f.kind === "source" || f.kind === "test"),
        ).length,
        analyzedCodeFiles: files.filter(
          (f) => f.language !== null && (f.kind === "source" || f.kind === "test") && f.analyzed,
        ).length,
        productionFiles: files.filter((f) => f.language !== null && f.kind === "source").length,
        testFiles: files.filter((f) => f.language !== null && f.kind === "test").length,
      },
      scope: { languages, excluded: excludedList, budgets: { ...config.budgets } },
      detection,
      coverage,
      files,
      graph,
      externalDependencies: externals,
      unresolvedImports: unresolved.slice(0, 200),
      metrics,
      findings: all,
      recommendations,
      scores,
      practices,
      history,
      security,
      executiveSummary: { headline: "", overview: [], strengths: [], concerns: [], nextSteps: [] },
      testCoverage: cov.summary,
      risk,
      blastRadius,
      rules: {
        evaluated: ruleSet !== null,
        source: opts.rules?.name ?? null,
        rules: (ruleSet?.rules ?? []).map((r) => ({
          id: r.id,
          type: r.type,
          severity: r.severity,
          description: r.description,
        })),
        violations: ruleSet === null ? null : ruleViolations,
        baseline: baseline ? { source: config.baselineFile, suppressed } : null,
      },
      methodology: {
        profile: DEFAULT_PROFILE.name,
        profileHash: profileHash(DEFAULT_PROFILE),
        configHash: configHash(config),
        scoringVersion: DEFAULT_PROFILE.version,
        glossaryVersion: GLOSSARY_VERSION,
      },
      reproducibility: {
        toolVersion: TOOL_VERSION,
        schemaVersion: REPORT_SCHEMA_VERSION,
        commitSha,
        toolVersions: {
          node: process.version,
          typescript: (await import("typescript")).default.version,
        },
        startedAt,
        finishedAt: "",
        inputDigest: inputDigestOf(files, texts),
        contentHash: "",
      },
      limitations,
    };
    report.executiveSummary = buildExecutiveSummary(report);
    report.reproducibility.finishedAt = now().toISOString();
    report.reproducibility.contentHash = contentHashOf(report);
    return report;
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export function inputDigestOf(files: FileRecord[], texts: Map<string, string>): string {
  const lines = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (f) =>
        `${f.path}\t${f.bytes}\t${texts.has(f.path) ? sha256(texts.get(f.path) as string) : "-"}`,
    );
  return sha256(lines.join("\n"));
}

/** Hash over everything except timestamps and the hash itself, used to verify determinism. */
export function contentHashOf(report: Report): string {
  const copy = JSON.parse(JSON.stringify(report)) as Report;
  copy.reproducibility.startedAt = "";
  copy.reproducibility.finishedAt = "";
  copy.reproducibility.contentHash = "";
  return sha256(stableStringify(copy));
}

export { languageOf };
