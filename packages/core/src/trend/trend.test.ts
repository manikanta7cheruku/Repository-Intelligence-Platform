import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/config.js";
import { computeTrend, sampleIndexes, sparkline, trendToMarkdown } from "./trend.js";

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "T",
  GIT_AUTHOR_EMAIL: "t@x.t",
  GIT_COMMITTER_NAME: "T",
  GIT_COMMITTER_EMAIL: "t@x.t",
};
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, env, encoding: "utf8" });

function growingRepo(commits: number): string {
  const d = mkdtempSync(join(tmpdir(), "rl-trend-"));
  dirs.push(d);
  g(d, "init", "-q", "-b", "main");
  mkdirSync(join(d, "src"), { recursive: true });
  for (let i = 0; i < commits; i++) {
    const imports = i > 0 ? `import { v${i - 1} } from "./f${i - 1}";\n` : "";
    writeFileSync(
      join(d, "src", `f${i}.ts`),
      `${imports}export const v${i} = ${i > 0 ? `v${i - 1} + ` : ""}${i};\n`,
    );
    g(d, "add", ".");
    g(d, "commit", "-q", "-m", `feat: add f${i}`);
  }
  return d;
}

describe("sampleIndexes and sparkline", () => {
  it("samples evenly including first and last", () => {
    expect(sampleIndexes(10, 4)).toEqual([0, 3, 6, 9]);
    expect(sampleIndexes(3, 6)).toEqual([0, 1, 2]);
    expect(sampleIndexes(2, 2)).toEqual([0, 1]);
  });
  it("draws a sparkline and handles flat and missing values", () => {
    expect(sparkline([1, 2, 3]).length).toBe(3);
    expect(sparkline([5, 5, 5])).toBe("\u2584\u2584\u2584");
    expect(sparkline([null, 1, 2])[0]).toBe(".");
    expect(sparkline([])).toBe("");
  });
});

describe("computeTrend", () => {
  it("analyzes evenly spaced commits and reports growth, drift and insights", async () => {
    const d = growingRepo(6);
    const t = await computeTrend(d, { config: resolveConfig({}), points: 3 });
    expect(t.points).toHaveLength(3);
    expect(t.points[0]?.files).toBeLessThan(t.points[2]?.files ?? 0);
    expect(t.points[0]?.edges).toBeLessThan(t.points[2]?.edges ?? 0);
    expect(t.drift?.edgesAdded).toBeGreaterThan(0);
    expect(t.insights.join(" ")).toMatch(/Code size changed/);
    expect(t.insights.join(" ")).toMatch(/Dependencies per file/);
    const md = trendToMarkdown(t);
    expect(md).toContain("# RepoLens trend");
    expect(md).toContain("Trend lines");
    expect(md).toContain("Limitations");
    expect(md.includes("\u2014")).toBe(false);
  });
  it("leaves the working tree and branches untouched and rejects unsafe refs", async () => {
    const d = growingRepo(3);
    await computeTrend(d, { config: resolveConfig({}), points: 2 });
    expect(g(d, "status", "--porcelain").trim()).toBe("");
    expect(g(d, "worktree", "list").trim().split("\n")).toHaveLength(1);
    let err = "";
    try {
      await computeTrend(d, { config: resolveConfig({}), ref: "--all" });
    } catch (e) {
      err = (e as Error).message;
    }
    expect(err).toMatch(/Unsafe/);
  });
});
