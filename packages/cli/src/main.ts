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
  acquireTarget,
  analyze,
  diffReports,
  diffToMarkdown,
  isGitHubTarget,
  parseGitHubUrl,
  reportSchema,
  resolveConfig,
  toHtml,
  toMarkdown,
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
