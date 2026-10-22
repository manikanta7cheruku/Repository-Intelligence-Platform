#!/usr/bin/env node
// Benchmark harness for Phase 1 (P1-18). Usage:
//   pnpm build
//   node scripts/benchmark.mjs <target> [<target> ...] [--runs 3] [--write docs/evaluation/results/benchmarks.md]
// A target is a local directory or a public GitHub URL. Run each target 3 times; the median is reported.
// Memory is process.resourceUsage().maxRSS, the peak resident set size of this process so far. Analysis is mostly
// synchronous, so sampling is not possible. For per-target numbers run one target per invocation.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import {
  acquireTarget,
  analyze,
  resolveConfig,
  validateReport,
} from "../packages/core/dist/index.js";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  if (i === -1) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const runs = Number(flag("--runs", "3"));
const out = flag("--write", null);
const targets = args;
if (targets.length === 0) {
  console.error(
    "Usage: node scripts/benchmark.mjs <path|github-url> ... [--runs 3] [--write file.md]",
  );
  process.exit(2);
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const config = resolveConfig({ security: { offline: true }, history: { enabled: false } });
const rows = [];
for (const target of targets) {
  const times = [];
  const mems = [];
  let report = null;
  let valid = true;
  for (let i = 0; i < runs; i++) {
    const acquired = await acquireTarget(target, { config, token: process.env.GITHUB_TOKEN });
    const t0 = performance.now();
    report = await analyze({
      config,
      workspace: acquired.workspace,
      source: acquired.source,
      commitSha: acquired.commitSha,
      historyRoot: null,
    });
    times.push(performance.now() - t0);
    mems.push(process.resourceUsage().maxRSS * 1024);
    valid = valid && validateReport(report).valid;
    acquired.cleanup();
  }
  const loc = report.metrics.totals.codeLines;
  const structural = report.coverage.reduce((s, c) => s + c.filesAnalyzed, 0);
  const eligible = report.coverage.reduce((s, c) => s + c.filesEligible, 0);
  rows.push({
    target,
    commit: report.repository.commitSha ?? "n/a",
    files: report.repository.totalFiles,
    loc,
    ms: Math.round(median(times)),
    mb: Math.round(median(mems) / 1048576),
    edges: report.graph.edges.length,
    resolution: report.graph.resolution.ratio,
    coverage: eligible === 0 ? null : structural / eligible,
    valid,
    hash: report.reproducibility.contentHash.slice(0, 12),
  });
  console.error(`done ${target}`);
}
const tsVersion = createRequire(import.meta.url)("typescript/package.json").version;
const f = (v) => (v === null ? "n/a" : v.toFixed(3));
const md = [
  "# Benchmark results",
  "",
  `Date ${new Date().toISOString().slice(0, 10)}. Node ${process.version}. TypeScript ${tsVersion}. Platform ${process.platform} ${process.arch}. Runs per target: ${runs} (median).`,
  "",
  "| Target | Commit | Files | Code lines | Median ms | Max RSS MB (process so far) | Edges | Resolution ratio | Structural coverage | Schema valid | Content hash |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.target} | ${r.commit} | ${r.files} | ${r.loc} | ${r.ms} | ${r.mb} | ${r.edges} | ${f(r.resolution)} | ${f(r.coverage)} | ${r.valid ? "yes" : "NO"} | ${r.hash} |`,
  ),
  "",
  "Max RSS is the peak of the whole Node.js process (including the TypeScript compiler), cumulative across targets in one invocation. Offline mode, no Git history, no vulnerability lookups. Machine details must be added by the person running the benchmark.",
  "",
].join("\n");
if (out) {
  writeFileSync(out, md);
  console.error(`Wrote ${out}`);
} else console.log(md);
