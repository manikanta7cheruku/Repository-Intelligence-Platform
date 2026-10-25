import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  ConfigError,
  GitHubUrlError,
  ArchiveError,
  AcquisitionError,
  RulesError,
  SEVERITY_RANK,
  TOOL_VERSION,
  GLOSSARY,
  GLOSSARY_VERSION,
  acquireTarget,
  analyze,
  analyzeDirectory,
  analyzeRef,
  assessPullRequest,
  buildReverseIndex,
  changedFiles,
  changedFilesWorkingTree,
  computeTrend,
  diffReports,
  diffToMarkdown,
  explain,
  impactOf,
  isGitHubTarget,
  isSafeGitRef,
  parseGitHubUrl,
  prToMarkdown,
  readRulesFrom,
  reportSchema,
  resolveConfig,
  resolveRef,
  toDot,
  toHtml,
  toMarkdown,
  toMermaid,
  toMermaidFiles,
  toSvg,
  trendToMarkdown,
  validateReport,
} from "@repolens/core";
import type { AnalysisConfig, Report, Severity, Stage } from "@repolens/core";
import { parseYamlConfig } from "./yaml-config.js";

export const EXIT = { OK: 0, POLICY: 1, USAGE: 2, ERROR: 3, PARTIAL: 4 } as const;

export interface Io {
  out: (s: string) => void;
  err: (s: string) => void;
  cwd: string;
  env: Record<string, string | undefined>;
  isTty: boolean;
}

const HELP = `RepoLens ${TOOL_VERSION}: explainable repository analysis

Usage:
  repolens analyze <path|github-url> [options]
  repolens report <report.json> [--format markdown|html] [--out <file>]
  repolens diff <before.json> <after.json> [--format markdown|json]
  repolens impact <report.json> <file> [--format markdown|json]
  repolens graph <report.json> [--format mermaid|dot|svg] [--module <path>] [--out <file>]
  repolens pr [path] --base <ref> [--head <ref>] [--online] [--fail-on-regression] [--format markdown|json]
  repolens pr --base-report <a.json> --head-report <b.json> [--changed <list.txt>]
  repolens trend [path] [--ref <ref>] [--points 6] [--format markdown|json]
  repolens glossary [term] [--format markdown|json]
  repolens schema
  repolens --version | --help

Analyze options:
  -f, --format <list>      json, markdown, html (comma separated or repeated). Default: json,markdown
  -o, --out <dir>          Output directory. Default: ./repolens-report
      --stdout             Print the JSON report to stdout (summary goes to stderr)
      --ref <ref>          Branch, tag or commit for GitHub targets
      --rules <file>       Architecture rules file (default: repolens.rules.yaml in the target)
      --baseline <file>    Accepted finding ids (JSON). Matching findings are suppressed
      --write-baseline <f> Write all current finding ids as a new baseline and exit 0
      --config <file>      Configuration file (JSON or simple YAML)
      --exclude <glob>     Exclude paths (repeatable)
      --offline            No network access (vulnerability lookups become "not assessed")
      --no-history         Skip Git history analysis
      --with-history       For GitHub targets, also clone shallowly for history (needs git)
      --coverage <file>    Coverage report to ingest (lcov.info, coverage-summary.json or Cobertura XML)
      --no-activity        For GitHub targets, do not call the GitHub API for commit, pull request and release signals
      --no-tests           Do not analyze test files
      --fail-on <severity> Exit 1 when any finding is at or above critical|high|medium|low
      --fail-on-partial    Exit 4 when the report is partial
  -q, --quiet              Print nothing except errors
  -h, --help               Show help

Exit codes: 0 ok, 1 policy failure, 2 usage or configuration error, 3 analysis error, 4 partial result (with --fail-on-partial).
The GitHub token, if needed, is read from GITHUB_TOKEN and is never written to reports or logs.
`;

class UsageError extends Error {}

function readJsonFile<T>(path: string, what: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (e) {
    throw new UsageError(`Cannot read ${what} ${path}: ${(e as Error).message}`);
  }
}

function loadConfigFile(path: string): Partial<AnalysisConfig> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(`Cannot read config file ${path}`);
  }
  try {
    return (
      path.endsWith(".json") ? JSON.parse(text) : parseYamlConfig(text)
    ) as Partial<AnalysisConfig>;
  } catch (e) {
    throw new UsageError(`Invalid config file ${path}: ${(e as Error).message}`);
  }
}

function summarize(r: Report, files: string[]): string {
  const lines: string[] = [];
  lines.push(`RepoLens ${TOOL_VERSION}: ${r.repository.name} (${r.status})`);
  lines.push(
    `Files: ${r.repository.analyzedFiles} analyzed of ${r.repository.totalFiles}. Graph: ${r.graph.nodes.length} files, ${r.graph.edges.length} edges, ${r.graph.cycles.length} cycles.`,
  );
  for (const s of r.scores)
    lines.push(
      `  ${s.dimension.padEnd(22)} ${s.state === "assessed" ? `${String(s.value).padStart(3)}  confidence ${s.confidence}` : "not assessed"}`,
    );
  const counts: Record<string, number> = {};
  for (const f of r.findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  lines.push(
    `Findings: ${r.findings.length} (${(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => `${counts[s] ?? 0} ${s}`).join(", ")})`,
  );
  for (const rec of r.recommendations.slice(0, 5)) lines.push(`  ${rec.rank}. ${rec.title}`);
  if (r.status !== "complete") lines.push("This report is partial. See the limitations section.");
  for (const f of files) lines.push(`Wrote ${f}`);
  return `${lines.join("\n")}\n`;
}

async function cmdAnalyze(argv: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      format: { type: "string", short: "f", multiple: true },
      out: { type: "string", short: "o" },
      stdout: { type: "boolean" },
      ref: { type: "string" },
      rules: { type: "string" },
      baseline: { type: "string" },
      "write-baseline": { type: "string" },
      config: { type: "string" },
      coverage: { type: "string" },
      "no-activity": { type: "boolean" },
      exclude: { type: "string", multiple: true },
      offline: { type: "boolean" },
      "no-history": { type: "boolean" },
      "with-history": { type: "boolean" },
      "no-tests": { type: "boolean" },
      "fail-on": { type: "string" },
      "fail-on-partial": { type: "boolean" },
      quiet: { type: "boolean", short: "q" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    io.out(HELP);
    return EXIT.OK;
  }
  const target = positionals[0];
  if (!target || positionals.length > 1)
    throw new UsageError("analyze needs exactly one target: a local path or a GitHub URL");
  const formats = new Set(
    (values.format ?? ["json,markdown"])
      .flatMap((f) => f.split(","))
      .map((f) => f.trim())
      .filter(Boolean),
  );
  for (const f of formats)
    if (!["json", "markdown", "html"].includes(f))
      throw new UsageError(`Unknown format ${f}. Use json, markdown or html.`);
  const failOn = values["fail-on"] as Severity | undefined;
  if (failOn !== undefined && !["critical", "high", "medium", "low"].includes(failOn))
    throw new UsageError("--fail-on must be critical, high, medium or low");
  const remote = isGitHubTarget(target);
  if (remote) {
    try {
      parseGitHubUrl(target);
    } catch (e) {
      throw new UsageError((e as Error).message);
    }
  }

  const localRoot = remote ? null : resolve(io.cwd, target);
  const autoConfig = localRoot
    ? ["repolens.config.json", "repolens.config.yaml", "repolens.config.yml"]
        .map((n) => join(localRoot, n))
        .find((p) => existsSync(p))
    : undefined;
  const configPath = values.config ? resolve(io.cwd, values.config) : autoConfig;
  const fileLayer = configPath ? loadConfigFile(configPath) : {};
  let config: AnalysisConfig;
  try {
    config = resolveConfig(fileLayer, {
      ...(values.exclude ? { exclude: [...(fileLayer.exclude ?? []), ...values.exclude] } : {}),
      ...(values["no-tests"] ? { includeTests: false } : {}),
      history: { ...(values["no-history"] ? { enabled: false } : {}) },
      security: { ...(values.offline ? { offline: true } : {}) },
    });
  } catch (e) {
    if (e instanceof ConfigError) throw new UsageError(e.message);
    throw e;
  }

  const rulesPath = values.rules
    ? resolve(io.cwd, values.rules)
    : localRoot
      ? ["repolens.rules.yaml", "repolens.rules.yml", "repolens.rules.json"]
          .map((n) => join(localRoot, n))
          .find((p) => existsSync(p))
      : undefined;
  let rules: { text: string; name: string } | null = null;
  if (rulesPath) {
    try {
      rules = {
        text: readFileSync(rulesPath, "utf8"),
        name: rulesPath.split(/[\\/]/).pop() as string,
      };
    } catch {
      throw new UsageError(`Cannot read rules file ${rulesPath}`);
    }
  }
  let baseline: { text: string } | null = null;
  if (values.baseline) {
    try {
      baseline = { text: readFileSync(resolve(io.cwd, values.baseline), "utf8") };
    } catch {
      throw new UsageError(`Cannot read baseline file ${values.baseline}`);
    }
  }

  const quiet = values.quiet === true;
  const log = (s: string) => {
    if (!quiet) io.err(`${s}\n`);
  };
  const progress = (stage: Stage, detail?: string) => {
    if (io.isTty && !quiet) io.err(`  ${stage}${detail ? ` (${detail})` : ""}\n`);
  };

  let coverage: { name: string; text: string } | null = null;
  if (values.coverage) {
    try {
      coverage = {
        name: values.coverage.split(/[\\/]/).pop() as string,
        text: readFileSync(resolve(io.cwd, values.coverage), "utf8"),
      };
    } catch {
      throw new UsageError(`Cannot read coverage file ${values.coverage}`);
    }
  }
  const spec = remote ? parseGitHubUrl(target) : null;
  const activity =
    spec && !values["no-activity"] && !values["with-history"] && !config.security.offline
      ? {
          owner: spec.owner,
          repo: spec.repo,
          ref: values.ref ?? spec.ref,
          token: io.env.GITHUB_TOKEN,
        }
      : null;
  let acquired;
  try {
    log(remote ? `Fetching ${target}` : `Reading ${resolve(io.cwd, target)}`);
    acquired = await acquireTarget(target, {
      config,
      ref: values.ref ?? null,
      token: io.env.GITHUB_TOKEN,
      withHistory: values["with-history"] === true,
    });
  } catch (e) {
    if (e instanceof AcquisitionError || e instanceof GitHubUrlError || e instanceof ArchiveError) {
      io.err(`Error: ${e.message}\n`);
      return EXIT.ERROR;
    }
    throw e;
  }
  let report: Report;
  try {
    report = await analyze({
      config: {
        ...config,
        ...(config.baselineFile === null && values.baseline
          ? { baselineFile: values.baseline }
          : {}),
        ...(rulesPath ? { rulesFile: rulesPath } : {}),
      },
      workspace: acquired.workspace,
      source: acquired.source,
      commitSha: acquired.commitSha,
      historyRoot: acquired.historyRoot,
      rules,
      baseline,
      coverage,
      activity,
      onProgress: progress,
    });
  } catch (e) {
    if (e instanceof RulesError) throw new UsageError(e.message);
    io.err(`Analysis failed: ${(e as Error).message}\n`);
    return EXIT.ERROR;
  } finally {
    acquired.cleanup();
  }
  const check = validateReport(report);
  if (!check.valid) {
    io.err(
      `Internal error: the generated report failed schema validation (${check.issues[0]?.path}: ${check.issues[0]?.message})\n`,
    );
    return EXIT.ERROR;
  }

  const written: string[] = [];
  if (values.stdout) {
    io.out(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const outDir = resolve(io.cwd, values.out ?? "repolens-report");
    mkdirSync(outDir, { recursive: true });
    const put = (name: string, content: string) => {
      const p = join(outDir, name);
      writeFileSync(p, content);
      written.push(p);
    };
    if (formats.has("json")) put("report.json", `${JSON.stringify(report, null, 2)}\n`);
    if (formats.has("markdown")) put("report.md", toMarkdown(report));
    if (formats.has("html")) put("report.html", toHtml(report));
  }
  if (values["write-baseline"]) {
    const p = resolve(io.cwd, values["write-baseline"]);
    writeFileSync(
      p,
      `${JSON.stringify({ accepted: report.findings.map((f) => f.id).sort() }, null, 2)}\n`,
    );
    written.push(p);
  }
  if (!quiet) (values.stdout ? io.err : io.out)(summarize(report, written));
  if (values["write-baseline"]) return EXIT.OK;

  const violated = report.findings.some((f) => f.ruleId.startsWith("rule."));
  const threshold = failOn ? SEVERITY_RANK[failOn] : null;
  const overThreshold =
    threshold !== null && report.findings.some((f) => SEVERITY_RANK[f.severity] <= threshold);
  if (violated || overThreshold) return EXIT.POLICY;
  if (values["fail-on-partial"] && report.status !== "complete") return EXIT.PARTIAL;
  return EXIT.OK;
}

function loadReport(path: string, io: Io): Report {
  const report = readJsonFile<unknown>(resolve(io.cwd, path), "report");
  const v = validateReport(report);
  if (!v.valid)
    throw new UsageError(
      `${path} is not a valid RepoLens report: ${v.issues[0]?.path} ${v.issues[0]?.message}`,
    );
  return report as Report;
}

function cmdReport(argv: string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: { format: { type: "string", short: "f" }, out: { type: "string", short: "o" } },
  });
  if (positionals.length !== 1) throw new UsageError("report needs one report.json path");
  const format = values.format ?? "markdown";
  if (format !== "markdown" && format !== "html")
    throw new UsageError("--format must be markdown or html");
  const report = loadReport(positionals[0] as string, io);
  const text = format === "html" ? toHtml(report) : toMarkdown(report);
  if (values.out) writeFileSync(resolve(io.cwd, values.out), text);
  else io.out(text);
  return EXIT.OK;
}

function cmdDiff(argv: string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: { format: { type: "string", short: "f" } },
  });
  if (positionals.length !== 2)
    throw new UsageError("diff needs two report.json paths: before and after");
  const d = diffReports(
    loadReport(positionals[0] as string, io),
    loadReport(positionals[1] as string, io),
  );
  io.out(values.format === "json" ? `${JSON.stringify(d, null, 2)}\n` : diffToMarkdown(d));
  return EXIT.OK;
}

function cmdImpact(argv: string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: { format: { type: "string", short: "f" } },
  });
  if (positionals.length !== 2)
    throw new UsageError("impact needs a report.json and a file path inside the repository");
  const report = loadReport(positionals[0] as string, io);
  const file = (positionals[1] as string).replace(/\\/g, "/").replace(/^\.\//, "");
  const idx = buildReverseIndex(
    report.graph,
    report.detection.entrypoints.map((e) => e.path),
  );
  const entry = impactOf(idx, file);
  if (!entry) {
    const base = file.split("/").pop() as string;
    const near = report.graph.nodes
      .filter((n) => n.path.endsWith(base))
      .slice(0, 5)
      .map((n) => n.path);
    throw new UsageError(
      `${file} is not a production source file in the dependency graph.${near.length ? ` Did you mean: ${near.join(", ")}?` : ""}`,
    );
  }
  if (values.format === "json") {
    io.out(`${JSON.stringify(entry, null, 2)}\n`);
    return EXIT.OK;
  }
  const direct = (idx.rev.get(idx.idByPath.get(file) as string) ?? [])
    .map((x) => idx.pathById.get(x.id) as string)
    .sort();
  io.out(
    [
      `# Blast radius of ${file}`,
      "",
      `- Direct dependents: ${entry.directDependents}`,
      `- All dependents (direct and indirect): ${entry.transitiveDependents} (${entry.runtimeTransitive} through runtime imports)`,
      `- Longest dependency chain: ${entry.maxDepth}`,
      `- Modules affected (${entry.modulesAffected.length}): ${entry.modulesAffected.join(", ") || "none"}`,
      `- Entrypoints affected (${entry.entrypointsAffected.length}): ${entry.entrypointsAffected.join(", ") || "none detected"}`,
      "",
      "Files that import it directly:",
      ...(direct.length ? direct.slice(0, 50).map((d) => `- ${d}`) : ["- none"]),
      "",
      "Static imports only. Dynamic imports with non-literal arguments and framework driven links are not included.",
      "",
    ].join("\n"),
  );
  return EXIT.OK;
}

function cmdGraph(argv: string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      format: { type: "string", short: "f" },
      module: { type: "string" },
      out: { type: "string", short: "o" },
    },
  });
  if (positionals.length !== 1) throw new UsageError("graph needs a report.json path");
  const format = values.format ?? "mermaid";
  if (!["mermaid", "dot", "svg"].includes(format))
    throw new UsageError("--format must be mermaid, dot or svg");
  const report = loadReport(positionals[0] as string, io);
  let text: string;
  if (values.module) {
    if (format !== "mermaid") throw new UsageError("--module supports only --format mermaid");
    const m = toMermaidFiles(report, values.module);
    if (!m)
      throw new UsageError(
        `Unknown module ${values.module}. Modules: ${report.graph.modules.map((x) => x.path).join(", ")}`,
      );
    text = m;
  } else
    text = format === "dot" ? toDot(report) : format === "svg" ? toSvg(report) : toMermaid(report);
  if (values.out) writeFileSync(resolve(io.cwd, values.out), text);
  else io.out(text);
  return EXIT.OK;
}

function cmdGlossary(argv: string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: { format: { type: "string", short: "f" } },
  });
  const entries = positionals[0]
    ? [explain(positionals[0])].filter((x): x is NonNullable<typeof x> => x !== null)
    : GLOSSARY;
  if (positionals[0] && entries.length === 0)
    throw new UsageError(`Unknown term ${positionals[0]}. Run repolens glossary to list all.`);
  if (values.format === "json") {
    io.out(`${JSON.stringify({ version: GLOSSARY_VERSION, entries }, null, 2)}\n`);
    return EXIT.OK;
  }
  io.out(
    `${entries.map((g) => `## ${g.label} (${g.id})\n\n${g.plain}\n\nTechnically: ${g.technical}\n\nWhy it matters: ${g.why}\n\nHow it is calculated: ${g.calculation}\n\nHow to improve: ${g.improve}\n`).join("\n")}`,
  );
  return EXIT.OK;
}

async function cmdPr(argv: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      base: { type: "string" },
      head: { type: "string" },
      "base-report": { type: "string" },
      "head-report": { type: "string" },
      changed: { type: "string" },
      rules: { type: "string" },
      baseline: { type: "string" },
      config: { type: "string" },
      online: { type: "boolean" },
      format: { type: "string", short: "f" },
      out: { type: "string", short: "o" },
      "fail-on-regression": { type: "boolean" },
      quiet: { type: "boolean", short: "q" },
    },
  });
  const format = values.format ?? "markdown";
  if (format !== "markdown" && format !== "json")
    throw new UsageError("--format must be markdown or json");
  let changed: string[] | null = null;
  if (values.changed) {
    try {
      changed = readFileSync(resolve(io.cwd, values.changed), "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    } catch {
      throw new UsageError(`Cannot read ${values.changed}`);
    }
  }
  let base: Report;
  let head: Report;
  if (values["base-report"] || values["head-report"]) {
    if (!values["base-report"] || !values["head-report"])
      throw new UsageError("Give both --base-report and --head-report");
    base = loadReport(values["base-report"], io);
    head = loadReport(values["head-report"], io);
  } else {
    if (!values.base)
      throw new UsageError("pr needs --base <ref> (or --base-report and --head-report)");
    if (!isSafeGitRef(values.base) || (values.head !== undefined && !isSafeGitRef(values.head)))
      throw new UsageError("Invalid ref");
    const root = resolve(io.cwd, positionals[0] ?? ".");
    const autoConfig = ["repolens.config.json", "repolens.config.yaml", "repolens.config.yml"]
      .map((n) => join(root, n))
      .find((p) => existsSync(p));
    const fileLayer = values.config
      ? loadConfigFile(resolve(io.cwd, values.config))
      : autoConfig
        ? loadConfigFile(autoConfig)
        : {};
    let config: AnalysisConfig;
    try {
      config = resolveConfig(fileLayer, {
        history: { enabled: false },
        security: { offline: values.online ? false : true },
      });
    } catch (e) {
      if (e instanceof ConfigError) throw new UsageError(e.message);
      throw e;
    }
    let rules: { text: string; name: string } | null = null;
    if (values.rules) {
      try {
        rules = {
          text: readFileSync(resolve(io.cwd, values.rules), "utf8"),
          name: values.rules.split(/[\\/]/).pop() as string,
        };
      } catch {
        throw new UsageError(`Cannot read rules file ${values.rules}`);
      }
    } else rules = readRulesFrom(root);
    const baseline = values.baseline
      ? { text: readFileSync(resolve(io.cwd, values.baseline), "utf8") }
      : null;
    try {
      const baseCommit = await resolveRef(root, values.base);
      if (!values.quiet) io.err(`Analyzing base ${values.base} (${baseCommit.slice(0, 7)})\n`);
      base = await analyzeRef(root, values.base, root.split(/[\\/]/).pop() as string, {
        config,
        rules,
        baseline,
      });
      if (!values.quiet)
        io.err(
          values.head ? `Analyzing head ${values.head}\n` : "Analyzing the working tree as head\n",
        );
      head = values.head
        ? await analyzeRef(root, values.head, root.split(/[\\/]/).pop() as string, {
            config,
            rules,
            baseline,
          })
        : await analyzeDirectory(root, root.split(/[\\/]/).pop() as string, {
            config,
            rules,
            baseline,
          });
      changed =
        changed ??
        (values.head
          ? await changedFiles(root, values.base, values.head)
          : await changedFilesWorkingTree(root, values.base));
    } catch (e) {
      if (e instanceof RulesError) throw new UsageError(e.message);
      io.err(`Error: ${(e as Error).message}\n`);
      return EXIT.ERROR;
    }
  }
  const assessment = assessPullRequest(base, head, { changedFiles: changed });
  const text =
    format === "json" ? `${JSON.stringify(assessment, null, 2)}\n` : prToMarkdown(assessment);
  if (values.out) writeFileSync(resolve(io.cwd, values.out), text);
  else io.out(text);
  return values["fail-on-regression"] && assessment.verdict === "regressed" ? EXIT.POLICY : EXIT.OK;
}

async function cmdTrend(argv: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      ref: { type: "string" },
      points: { type: "string" },
      format: { type: "string", short: "f" },
      config: { type: "string" },
      out: { type: "string", short: "o" },
      quiet: { type: "boolean", short: "q" },
    },
  });
  const format = values.format ?? "markdown";
  if (format !== "markdown" && format !== "json")
    throw new UsageError("--format must be markdown or json");
  const points = values.points ? Number(values.points) : 6;
  if (!Number.isInteger(points) || points < 2 || points > 15)
    throw new UsageError("--points must be an integer from 2 to 15");
  const root = resolve(io.cwd, positionals[0] ?? ".");
  const autoConfig = ["repolens.config.json", "repolens.config.yaml", "repolens.config.yml"]
    .map((n) => join(root, n))
    .find((p) => existsSync(p));
  const fileLayer = values.config
    ? loadConfigFile(resolve(io.cwd, values.config))
    : autoConfig
      ? loadConfigFile(autoConfig)
      : {};
  let config: AnalysisConfig;
  try {
    config = resolveConfig(fileLayer);
  } catch (e) {
    if (e instanceof ConfigError) throw new UsageError(e.message);
    throw e;
  }
  try {
    const t = await computeTrend(root, {
      config,
      points,
      ...(values.ref ? { ref: values.ref } : {}),
      rules: readRulesFrom(root),
      onProgress: (d, n, c) => {
        if (!values.quiet) io.err(`  ${d}/${n} analyzed ${c}\n`);
      },
    });
    const text = format === "json" ? `${JSON.stringify(t, null, 2)}\n` : trendToMarkdown(t);
    if (values.out) writeFileSync(resolve(io.cwd, values.out), text);
    else io.out(text);
    return EXIT.OK;
  } catch (e) {
    io.err(`Error: ${(e as Error).message}\n`);
    return EXIT.ERROR;
  }
}

export async function runCli(argv: string[], io: Io): Promise<number> {
  try {
    const [cmd, ...rest] = argv;
    if (cmd === undefined || cmd === "--help" || cmd === "-h" || cmd === "help") {
      io.out(HELP);
      return cmd === undefined ? EXIT.USAGE : EXIT.OK;
    }
    if (cmd === "--version" || cmd === "-v" || cmd === "version") {
      io.out(`${TOOL_VERSION}\n`);
      return EXIT.OK;
    }
    if (cmd === "analyze") return await cmdAnalyze(rest, io);
    if (cmd === "report") return cmdReport(rest, io);
    if (cmd === "diff") return cmdDiff(rest, io);
    if (cmd === "impact") return cmdImpact(rest, io);
    if (cmd === "graph") return cmdGraph(rest, io);
    if (cmd === "glossary") return cmdGlossary(rest, io);
    if (cmd === "pr") return await cmdPr(rest, io);
    if (cmd === "trend") return await cmdTrend(rest, io);
    if (cmd === "schema") {
      io.out(`${JSON.stringify(reportSchema, null, 2)}\n`);
      return EXIT.OK;
    }
    throw new UsageError(`Unknown command ${cmd}. Run repolens --help.`);
  } catch (e) {
    if (e instanceof UsageError || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")) {
      io.err(`Usage error: ${(e as Error).message}\n`);
      return EXIT.USAGE;
    }
    io.err(`Unexpected error: ${(e as Error).message}\n`);
    return EXIT.ERROR;
  }
}
