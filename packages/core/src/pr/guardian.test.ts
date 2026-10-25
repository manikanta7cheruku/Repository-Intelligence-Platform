import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/config.js";
import {
  changedFiles,
  changedFilesWorkingTree,
  isSafeGitRef,
  withWorktree,
} from "../git/worktree.js";
import { analyzeRef, readRulesFrom } from "../pipeline/snapshot.js";
import { assessPullRequest, prToMarkdown } from "./guardian.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures");
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
const g = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env, encoding: "utf8" });
const config = resolveConfig({ security: { offline: true }, history: { enabled: false } });

function repo(): string {
  const d = mkdtempSync(join(tmpdir(), "rl-pr-"));
  dirs.push(d);
  cpSync(join(FIXTURES, "ts-layered-clean"), d, { recursive: true });
  g(d, "init", "-q", "-b", "main");
  g(d, "add", ".");
  g(d, "commit", "-q", "-m", "base");
  return d;
}
const analyze = (root: string, ref: string, over = config) =>
  analyzeRef(root, ref, "pr-test", { config: over, rules: readRulesFrom(root) });

const BAD_SERVICE = `import { Repo } from "../data/repo";
import { render } from "../ui/app";
export class Service { run(): string { return new Repo().load(render()); } }
export function start(): void { new Service(); }
`;

describe("pull request guardian", () => {
  it("flags a regression: new rule violation and new circular dependency, with blast radius of the change", async () => {
    const d = repo();
    writeFileSync(join(d, "src/domain/service.ts"), BAD_SERVICE);
    g(d, "commit", "-q", "-am", "domain depends on ui");
    const a = assessPullRequest(await analyze(d, "HEAD~1"), await analyze(d, "HEAD"), {
      changedFiles: await changedFiles(d, "HEAD~1", "HEAD"),
    });
    expect(a.verdict).toBe("regressed");
    expect(a.reasons.join(" ")).toMatch(/rule violation/);
    expect(a.reasons.join(" ")).toMatch(/circular/);
    expect(a.newRuleViolations.some((f) => f.ruleId === "rule.domain-not-ui")).toBe(true);
    expect(a.newCycles.length).toBeGreaterThan(0);
    expect(a.changedFiles).toEqual(["src/domain/service.ts"]);
    expect(a.blastRadiusOfChanges[0]?.path).toBe("src/domain/service.ts");
    const md = prToMarkdown(a);
    expect(md).toContain("Architecture regressed");
    expect(md).toContain("New rule violations");
    expect(md).toContain("Blast radius of this change");
    expect(md.includes("\u2014")).toBe(false);
  });
  it("recognizes an improvement when a violation and its cycle are removed", async () => {
    const d = repo();
    writeFileSync(join(d, "src/domain/service.ts"), BAD_SERVICE);
    g(d, "commit", "-q", "-am", "bad");
    cpSync(
      join(FIXTURES, "ts-layered-clean/src/domain/service.ts"),
      join(d, "src/domain/service.ts"),
    );
    g(d, "commit", "-q", "-am", "fix");
    const a = assessPullRequest(await analyze(d, "HEAD~1"), await analyze(d, "HEAD"));
    expect(a.verdict).toBe("improved");
    expect(a.resolvedCycles.length).toBeGreaterThan(0);
    expect(a.resolvedFindings.length).toBeGreaterThan(0);
  });
  it("reports unchanged for an identical analysis and for a harmless change", async () => {
    const d = repo();
    writeFileSync(
      join(d, "src/ui/format.ts"),
      "export const fmt = (s: string): string => s.trim().toUpperCase();\n",
    );
    g(d, "commit", "-q", "-am", "harmless");
    const a = assessPullRequest(await analyze(d, "HEAD~1"), await analyze(d, "HEAD"));
    expect(a.verdict).toBe("unchanged");
    expect(a.reasons[0]).toMatch(/No new rule violations/);
    expect(a.newEdges).toEqual([]);
  });
  it("lists new third-party packages and new cross-module edges", async () => {
    const d = repo();
    writeFileSync(
      join(d, "src/ui/format.ts"),
      'import _ from "lodash";\nimport { Repo } from "../data/repo";\nexport const fmt = (s: string): string => _.trim(s) + String(Repo);\n',
    );
    g(d, "commit", "-q", "-am", "deps");
    const a = assessPullRequest(await analyze(d, "HEAD~1"), await analyze(d, "HEAD"));
    expect(a.newExternalPackages).toEqual(["lodash"]);
    expect(a.newCrossModuleEdges).toEqual([["src/ui/format.ts", "src/data/repo.ts"]]);
  });
  it("warns when the two analyses used different configurations", async () => {
    const d = repo();
    const a = assessPullRequest(
      await analyze(d, "HEAD"),
      await analyze(
        d,
        "HEAD",
        resolveConfig({ security: { offline: true }, history: { enabled: false }, moduleDepth: 2 }),
      ),
    );
    expect(a.configMatches).toBe(false);
    expect(prToMarkdown(a)).toMatch(/different configurations/);
  });
});

describe("git worktree helpers", () => {
  it("checks out a ref without touching the working tree and cleans up", async () => {
    const d = repo();
    writeFileSync(join(d, "NEW.txt"), "x");
    g(d, "add", ".");
    g(d, "commit", "-q", "-m", "two");
    writeFileSync(join(d, "dirty.txt"), "uncommitted");
    let seen = "";
    await withWorktree(d, "HEAD~1", async (dir) => {
      seen = dir;
      expect(existsSync(join(dir, "NEW.txt"))).toBe(false);
      expect(existsSync(join(dir, "src/index.ts"))).toBe(true);
    });
    expect(existsSync(seen)).toBe(false);
    expect(existsSync(join(d, "dirty.txt"))).toBe(true);
    expect(g(d, "worktree", "list").trim().split("\n")).toHaveLength(1);
  });
  it("lists changed files against a ref, including untracked files", async () => {
    const d = repo();
    writeFileSync(join(d, "src/ui/format.ts"), "export const fmt = (s: string): string => s;\n");
    writeFileSync(join(d, "brand-new.ts"), "export {};\n");
    expect(await changedFilesWorkingTree(d, "HEAD")).toEqual(["brand-new.ts", "src/ui/format.ts"]);
  });
  it("rejects unsafe refs and unknown refs", async () => {
    expect(isSafeGitRef("--upload-pack=x")).toBe(false);
    expect(isSafeGitRef("a..b")).toBe(false);
    expect(isSafeGitRef("feature/x-1")).toBe(true);
    let err = "";
    try {
      await withWorktree(repo(), "no-such-ref", async () => 1);
    } catch (e) {
      err = (e as Error).message;
    }
    expect(err).toMatch(/Cannot check out/);
  });
});
