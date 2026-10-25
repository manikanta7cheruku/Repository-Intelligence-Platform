// Builds apps/web/public/sample/report.json: a real analysis of this repository with anonymized authors
// and the local path replaced by the public repository URL. Run after `pnpm build`.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "rip-sample-"));
try {
  writeFileSync(join(work, "anon.yaml"), "history:\n  authors: anonymous\n");
  const cli = join(root, "packages", "cli", "dist", "index.js");
  const run = spawnSync(
    process.execPath,
    [
      cli,
      "analyze",
      root,
      "--offline",
      "-q",
      "--config",
      join(work, "anon.yaml"),
      "-f",
      "json",
      "-o",
      work,
    ],
    { stdio: "inherit" },
  );
  if (run.status !== 0 && run.status !== 1) throw new Error(`analysis exited with ${run.status}`);
  const report = JSON.parse(readFileSync(join(work, "report.json"), "utf8"));
  report.repository.source.location =
    "https://github.com/manikanta7cheruku/Repository-Intelligence-Platform";
  const out = join(root, "apps", "web", "public", "sample", "report.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report)}\n`);
  console.log(`Wrote ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
