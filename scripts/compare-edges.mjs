#!/usr/bin/env node
// Gate P1-01 helper: compare RepoLens dependency edges with Madge or dependency-cruiser output.
//   madge:            npx madge --json --extensions ts,tsx,js,jsx <dir> > madge.json
//   dependency-cruiser: npx depcruise <dir> --no-config --output-type json > depcruise.json
//   node scripts/compare-edges.mjs report.json madge.json [--prefix <dir>]
// --prefix is the directory you gave to the other tool, relative to the analyzed root (for example "src"),
// because those tools print paths relative to that directory. The comparison is a starting point for MANUAL
// review: every disagreement must be checked by reading the code. Neither tool is ground truth.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const pi = args.indexOf("--prefix");
const prefix = pi === -1 ? "" : (args.splice(pi, 2)[1] ?? "").replace(/\/$/, "");
const [reportPath, otherPath] = args;
if (!reportPath || !otherPath) {
  console.error("Usage: node scripts/compare-edges.mjs report.json other-tool.json [--prefix src]");
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const other = JSON.parse(readFileSync(otherPath, "utf8"));
const norm = (p) =>
  (prefix && !p.startsWith(`${prefix}/`) ? `${prefix}/${p}` : p).replace(/^\.\//, "");

const idToPath = new Map(report.graph.nodes.map((n) => [n.id, n.path]));
const ours = new Set(
  report.graph.edges.map((e) => `${idToPath.get(e.from)}>${idToPath.get(e.to)}`),
);

const theirs = new Set();
if (Array.isArray(other.modules)) {
  for (const m of other.modules) {
    for (const d of m.dependencies ?? []) {
      if (d.resolved && !d.coreModule && !/node_modules/.test(d.resolved))
        theirs.add(`${norm(m.source)}>${norm(d.resolved)}`);
    }
  }
} else {
  for (const [from, deps] of Object.entries(other))
    for (const d of deps) theirs.add(`${norm(from)}>${norm(d)}`);
}

// Only compare files both tools know about, so that scope differences are not counted as errors.
const knownOurs = new Set(report.graph.nodes.map((n) => n.path));
const files = new Set([...theirs].flatMap((e) => e.split(">")));
const common = (e) => e.split(">").every((p) => knownOurs.has(p) || files.has(p));
const onlyOurs = [...ours].filter((e) => !theirs.has(e) && common(e)).sort();
const onlyTheirs = [...theirs].filter((e) => !ours.has(e)).sort();
const both = [...ours].filter((e) => theirs.has(e)).length;
const f = (v) => (Number.isFinite(v) ? v.toFixed(3) : "n/a");
console.log(`RepoLens edges: ${ours.size}. Other tool edges: ${theirs.size}. Agreement: ${both}.`);
console.log(
  `Agreement / RepoLens edges: ${f(both / ours.size)}. Agreement / other tool edges: ${f(both / theirs.size)}.`,
);
console.log(`\nOnly in RepoLens (${onlyOurs.length}), check each by reading the import:`);
for (const e of onlyOurs.slice(0, 50)) console.log(`  ${e.replace(">", "  ->  ")}`);
console.log(`\nOnly in the other tool (${onlyTheirs.length}), check each by reading the import:`);
for (const e of onlyTheirs.slice(0, 50)) console.log(`  ${e.replace(">", "  ->  ")}`);
console.log(
  "\nRecord confirmed RepoLens errors (false positives and false negatives) in docs/evaluation/results/p1-01-spike.md",
);
