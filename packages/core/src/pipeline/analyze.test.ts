import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/config.js";
import { openLocalWorkspace } from "../acquire/local.js";
import { jsTsAnalyzer } from "../analyzers/js-ts.js";
import { pythonAnalyzer } from "../analyzers/python.js";
import type { AnalyzerPlugin } from "../analyzers/types.js";
import { validateReport } from "../ir/schema.js";
import { RulesError } from "../rules/engine.js";
import type { OsvFetch } from "../security/osv.js";
import { analyze, type AnalyzeOptions } from "./analyze.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures");
let dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rl-pipe-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

const offline = (over: Parameters<typeof resolveConfig>[0] = {}) =>
  resolveConfig({ security: { offline: true }, history: { enabled: false } }, over);
const run = (
  dir: string,
  over: Partial<AnalyzeOptions> = {},
  cfgOver: Parameters<typeof resolveConfig>[0] = {},
) => {
  const config = offline(cfgOver);
  return analyze({
    config,
    workspace: openLocalWorkspace(dir, config),
    source: { type: "local", location: "fixture", ref: null, name: "fixture" },
    historyRoot: null,
    ...over,
  });
};
const write = (files: Record<string, string>) => {
  const d = tmp();
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
};

describe("report validity and determinism", () => {
  it("produces schema-valid reports for every fixture", async () => {
    for (const name of readdirSync(FIXTURES, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)) {
      const r = await run(join(FIXTURES, name));
      const v = validateReport(r);
      expect(v.issues.slice(0, 3)).toEqual([]);
    }
  });
  it("is deterministic: same content hash regardless of file creation order or location", async () => {
    const a = tmp();
    const b = tmp();
    cpSync(join(FIXTURES, "ts-cycle"), join(a, "x"), { recursive: true });
    const files = [
      "src/x/three.ts",
      "src/y/two.ts",
      "src/x/one.ts",
      "src/t2.ts",
      "src/t1.ts",
      "src/d.ts",
      "src/c.ts",
      "src/b.ts",
      "src/a.ts",
      "tsconfig.json",
      "expected.json",
    ];
    for (const f of files) {
      mkdirSync(join(b, "x", f, ".."), { recursive: true });
      cpSync(join(FIXTURES, "ts-cycle", f), join(b, "x", f));
    }
    const ra = await run(join(a, "x"));
    const rb = await run(join(b, "x"));
    expect(ra.reproducibility.contentHash).toBe(rb.reproducibility.contentHash);
    expect(JSON.stringify(ra.findings)).toBe(JSON.stringify(rb.findings));
    expect(JSON.stringify(ra.graph)).toBe(JSON.stringify(rb.graph));
  });
  it("changes the hash when the code changes", async () => {
    const d = write({ "src/a.ts": "export const a = 1;\n" });
    const h1 = (await run(d)).reproducibility.contentHash;
    writeFileSync(join(d, "src/a.ts"), "export const a = 2;\n");
    expect(h1).not.toBe((await run(d)).reproducibility.contentHash);
  });
});

describe("honest partial results", () => {
  it("marks the report partial and keeps other analyzers when one analyzer fails", async () => {
    const failing: AnalyzerPlugin = {
      ...jsTsAnalyzer,
      id: "broken-js",
      analyze: () => Promise.reject(new Error("boom")),
    };
    const r = await run(join(FIXTURES, "mixed-languages"), {
      analyzers: [failing, pythonAnalyzer],
    });
    expect(r.status).toBe("partial");
    expect(r.limitations.join(" ")).toMatch(/Analyzer broken-js failed: boom/);
    expect(r.scope.languages.find((l) => l.language === "typescript")?.supportLevel).toBe(1);
    expect(r.scope.languages.find((l) => l.language === "python")?.supportLevel).toBe(2);
    expect(validateReport(r).valid).toBe(true);
  });
  it("marks the report partial and reports truncation when budgets are hit", async () => {
    const r = await run(join(FIXTURES, "ts-layered-clean"), {}, { budgets: { maxFiles: 3 } });
    expect(r.status).toBe("partial");
    expect(r.repository.truncated).toBe(true);
    expect(r.findings.some((f) => f.ruleId === "analysis.truncated")).toBe(true);
  });
  it("treats an aborted run as a partial result, not a crash", async () => {
    const c = new AbortController();
    c.abort();
    const r = await run(join(FIXTURES, "ts-layered-clean"), { signal: c.signal });
    expect(r.status).toBe("partial");
  });
  it("does not invent architecture for unsupported languages", async () => {
    const r = await run(join(FIXTURES, "unsupported-only"));
    expect(r.status).toBe("complete");
    expect(r.graph.nodes).toEqual([]);
    expect(r.graph.resolution.ratio).toBeNull();
    for (const d of ["architecture", "maintainability"]) {
      const s = r.scores.find((x) => x.dimension === d);
      expect(s).toMatchObject({ state: "not-assessed", value: null });
      expect(s?.reason).toBeTruthy();
    }
    expect(r.findings.some((f) => f.ruleId === "analysis.unsupported-language")).toBe(true);
  });
  it("never reports missing data as zero", async () => {
    const r = await run(join(FIXTURES, "ts-layered-clean"));
    expect(r.history.available).toBe(false);
    expect(r.history.commitsAnalyzed).toBeNull();
    expect(r.security.dependencies).toMatchObject({
      assessed: false,
      vulnerabilities: null,
      packagesChecked: null,
    });
    expect(r.scores.find((s) => s.dimension === "maintenance-activity")).toMatchObject({
      state: "not-assessed",
      value: null,
    });
    expect(r.metrics.functionCount).toBeGreaterThan(0);
    expect(r.rules).toMatchObject({ evaluated: false, violations: null });
  });
});

describe("rules and baselines", () => {
  it("fails fast with a RulesError for an invalid rules file", async () => {
    const d = write({ "src/a.ts": "export {};\n" });
    let err: unknown;
    try {
      await run(d, { rules: { text: "version: 2", name: "r.yaml" } });
    } catch (e) {
      err = e;
    }
    expect(err instanceof RulesError).toBe(true);
  });
  it("suppresses baselined findings and reports how many", async () => {
    const dir = join(FIXTURES, "ts-violation");
    const rules = {
      text: 'version: 1\nlayers:\n  - name: ui\n    paths: ["src/ui/**"]\n  - name: domain\n    paths: ["src/domain/**"]\nrules:\n  - id: ui-in-domain\n    forbid:\n      from: domain\n      to: ui\n',
      name: "r.yaml",
    };
    const first = await run(dir, { rules });
    const ids = first.findings.filter((f) => f.ruleId.startsWith("rule.")).map((f) => f.id);
    expect(ids).toHaveLength(1);
    const second = await run(dir, { rules, baseline: { text: JSON.stringify({ accepted: ids }) } });
    expect(second.findings.some((f) => f.ruleId.startsWith("rule."))).toBe(false);
    expect(second.rules).toMatchObject({ violations: 0, baseline: { suppressed: 1 } });
  });
});

describe("security integration", () => {
  const lock = JSON.stringify({
    lockfileVersion: 3,
    packages: { "": {}, "node_modules/lodash": { version: "4.17.20" } },
  });
  const dir = () =>
    write({
      "package.json": '{ "name": "x" }',
      "package-lock.json": lock,
      "src/a.ts": "export {};\n",
    });
  const fetchImpl: OsvFetch = (url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          url.endsWith("querybatch")
            ? { results: [{ vulns: [{ id: "GHSA-x" }] }] }
            : { id: "GHSA-x", summary: "bad", database_specific: { severity: "CRITICAL" } },
        ),
    });
  it("matches vulnerable dependencies when online and lowers the security score", async () => {
    const d = dir();
    const config = resolveConfig({ history: { enabled: false } });
    const r = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "local", location: "x", ref: null },
      historyRoot: null,
      osvFetch: fetchImpl,
    });
    expect(r.security.dependencies).toMatchObject({
      assessed: true,
      vulnerabilities: 1,
      packagesChecked: 1,
    });
    expect(r.findings.find((f) => f.ruleId === "security.osv")?.severity).toBe("critical");
    expect(r.recommendations[0]?.title).toMatch(/Upgrade lodash/);
    const clean: OsvFetch = () =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [{}] }) });
    const cleanRun = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "local", location: "x", ref: null },
      historyRoot: null,
      osvFetch: clean,
    });
    const score = (rep: typeof r) =>
      rep.scores.find((s) => s.dimension === "security-hygiene")?.value ?? -1;
    expect(cleanRun.security.dependencies).toMatchObject({ assessed: true, vulnerabilities: 0 });
    expect(score(r)).toBeLessThan(score(cleanRun));
    const offlineRun = await run(d);
    expect(offlineRun.scores.find((s) => s.dimension === "security-hygiene")?.state).toBe(
      "not-assessed",
    );
  });
  it("is partial, not complete, when the OSV lookup fails while online", async () => {
    const d = dir();
    const config = resolveConfig({ history: { enabled: false } });
    const r = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "local", location: "x", ref: null },
      historyRoot: null,
      osvFetch: () => Promise.reject(new Error("offline")),
    });
    expect(r.status).toBe("partial");
    expect(r.security.dependencies.assessed).toBe(false);
  });
  it("states the offline reason without marking the report partial", async () => {
    const r = await run(dir());
    expect(r.status).toBe("complete");
    expect(r.security.dependencies.reason).toMatch(/Offline/);
  });
  it("finds committed secrets, redacts them, and never claims the repository is secure", async () => {
    const secret = ["AKIA", "QWERTYUIOPASDFGH"].join("");
    const d = write({ "src/config.ts": `export const k = "${secret}";\n` });
    const r = await run(d);
    expect(r.findings.some((f) => f.ruleId === "security.secret.aws-access-key-id")).toBe(true);
    expect(JSON.stringify(r)).not.toContain(secret);
    expect(r.security.statement).toMatch(/do not show that the repository is secure/);
  });
});

describe("git history integration", () => {
  it("adds history, hotspots and the commit sha for a local repository", async () => {
    const d = write({ "src/a.ts": "export const a = 1;\n" });
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "A",
      GIT_AUTHOR_EMAIL: "a@x.t",
      GIT_COMMITTER_NAME: "A",
      GIT_COMMITTER_EMAIL: "a@x.t",
    };
    const git = (...args: string[]) => execFileSync("git", args, { cwd: d, env, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("add", ".");
    git("commit", "-q", "-m", "one");
    writeFileSync(join(d, "src/a.ts"), "export const a = 2;\n");
    git("commit", "-q", "-am", "two");
    const config = resolveConfig({ security: { offline: true } });
    const r = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "local", location: d, ref: null },
      historyRoot: d,
    });
    expect(r.history.available).toBe(true);
    expect(r.history.commitsAnalyzed).toBe(2);
    expect(r.repository.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(r.history.shallow).toBe(false);
  });
});
