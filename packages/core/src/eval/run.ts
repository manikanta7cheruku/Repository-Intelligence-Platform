import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { aggregate, evaluateAll, resultsMarkdown } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(
  process.env.REPOLENS_FIXTURES ?? join(here, "..", "..", "..", "..", "fixtures"),
);
const writeIdx = process.argv.indexOf("--write");
const results = await evaluateAll(fixtures);
const tsVersion = createRequire(import.meta.url)("typescript/package.json").version as string;
const md = resultsMarkdown(results, {
  date: new Date().toISOString().slice(0, 10),
  node: process.version,
  typescript: tsVersion,
});
if (writeIdx !== -1 && process.argv[writeIdx + 1]) {
  writeFileSync(process.argv[writeIdx + 1] as string, md);
  console.log(`Wrote ${process.argv[writeIdx + 1]}`);
} else {
  console.log(md);
}
const agg = aggregate(results);
const bad =
  results.some((r) => r.failures.length > 0) ||
  Object.values(agg).some((v) => (v.precision ?? 1) < 1 || (v.recall ?? 1) < 1);
process.exitCode = bad ? 1 : 0;
