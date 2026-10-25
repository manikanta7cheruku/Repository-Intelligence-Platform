import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openLocalWorkspace } from "../acquire/local.js";
import { resolveConfig } from "../config/config.js";
import type { JsonFetch } from "../git/activity.js";
import { validateReport } from "../ir/schema.js";
import type { OsvFetch } from "../security/osv.js";
import { analyze, type AnalyzeOptions } from "./analyze.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures");
let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rl-p15-"));
  dirs.push(d);
  return d;
};
const write = (files: Record<string, string>) => {
  const d = tmp();
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
};
const run = (
  dir: string,
  over: Partial<AnalyzeOptions> = {},
  cfg: Parameters<typeof resolveConfig>[0] = {},
) => {
  const config = resolveConfig({ security: { offline: true }, history: { enabled: false } }, cfg);
  return analyze({
    config,
    workspace: openLocalWorkspace(dir, config),
    source: { type: "local", location: "x", ref: null, name: "x" },
    historyRoot: null,
    ...over,
  });
};

describe("report content added in 0.2.0", () => {
  it("counts code files, production files and tests separately", async () => {
    const r = await run(join(FIXTURES, "ts-blast-radius"));
    expect(r.repository).toMatchObject({
      productionFiles: 6,
      testFiles: 1,
      codeFiles: 7,
      analyzedCodeFiles: 7,
    });
    expect(r.repository.totalFiles).toBeGreaterThan(r.repository.codeFiles);
    expect(validateReport(r).valid).toBe(true);
  });
  it("writes an executive summary from facts only", async () => {
    const r = await run(join(FIXTURES, "ts-blast-radius"));
    const s = r.executiveSummary;
    expect(s.headline).toContain("x is a TypeScript repository");
    expect(s.overview[0]).toMatch(/7 of 7 code files \(6 production, 1 test\)/);
    expect(s.overview.join(" ")).toMatch(/no circular dependencies/);
    expect(s.strengths.length).toBeGreaterThan(0);
    for (const t of [s.headline, ...s.overview, ...s.strengths, ...s.concerns, ...s.nextSteps])
      expect(t.includes("\u2014")).toBe(false);
  });
  it("states why a score cannot be given and what would enable it", async () => {
    const r = await run(join(FIXTURES, "unsupported-only"));
    expect(r.executiveSummary.overview.join(" ")).toMatch(/Not assessed/);
    expect(r.executiveSummary.concerns.join(" ")).toMatch(
      /only received detection and line counts/,
    );
    const arch = r.scores.find((s) => s.dimension === "architecture");
    expect(arch?.weightCoverage).not.toBeNull();
    expect(arch?.reason).toBeTruthy();
  });
  it("shows how much each input could improve a score, and which inputs were used", async () => {
    const r = await run(join(FIXTURES, "ts-cycle"));
    const arch = r.scores.find((s) => s.dimension === "architecture");
    expect(arch?.state).toBe("assessed");
    const cycles = arch?.inputs.find((i) => i.name === "file-cycle-ratio");
    expect(cycles?.impact).toBeGreaterThan(0);
    expect(arch?.inputs.find((i) => i.name === "rule-violations-per-100-edges")).toMatchObject({
      available: false,
      impact: null,
    });
    expect(arch?.weightCoverage).toBeLessThan(1);
  });
});

describe("blast radius and risk in the pipeline", () => {
  it("reports the hub file with known dependents", async () => {
    const r = await run(join(FIXTURES, "ts-blast-radius"));
    const hub = r.blastRadius.find((b) => b.path === "src/core/util.ts");
    expect(hub).toMatchObject({ directDependents: 3, transitiveDependents: 4 });
    expect(hub?.entrypointsAffected).toEqual(["src/index.ts"]);
  });
  it("links tests to source files and uses that in the risk index", async () => {
    const r = await run(join(FIXTURES, "ts-blast-radius"));
    expect(r.risk.assessed).toBe(true);
    const util = r.risk.files.find((f) => f.path === "src/core/util.ts");
    const three = r.risk.files.find((f) => f.path === "src/b/three.ts");
    expect(util?.factors.find((f) => f.name === "tests")?.note).toMatch(
      /imported directly by a test/,
    );
    expect(three?.factors.find((f) => f.name === "tests")?.note).toMatch(/no test file imports it/);
  });
});

describe("coverage ingestion in the pipeline", () => {
  it("reads a coverage report from the repository and feeds it to scoring and risk", async () => {
    const d = write({
      "package.json": '{ "name": "c" }',
      "tsconfig.json": "{}",
      ...Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [`src/f${i}.ts`, `export const v${i} = ${i};\n`]),
      ),
      "src/f0.test.ts": 'import { v0 } from "./f0";\nexport const t = v0;\n',
      "coverage/lcov.info":
        "SF:src/f0.ts\nLF:10\nLH:9\nend_of_record\nSF:src/f1.ts\nLF:10\nLH:1\nend_of_record\n",
    });
    const r = await run(d);
    expect(r.testCoverage).toMatchObject({ ingested: true, format: "lcov", filesMatched: 2 });
    expect(r.testCoverage.lineRate).toBe(0.5);
    expect(r.practices.tests.coverageReport).toBe("ingested");
    expect(
      r.scores
        .find((s) => s.dimension === "testing-ci")
        ?.inputs.find((i) => i.name === "line-coverage"),
    ).toMatchObject({ available: true, raw: 0.5 });
    expect(
      r.risk.files.find((f) => f.path === "src/f1.ts")?.factors.find((f) => f.name === "tests")
        ?.note,
    ).toMatch(/10 percent/);
  });
  it("accepts a supplied coverage report and is honest when none exists", async () => {
    const d = write({ "src/a.ts": "export const a = 1;\n" });
    expect((await run(d)).testCoverage).toMatchObject({ ingested: false, lineRate: null });
    const r = await run(d, {
      coverage: { name: "lcov.info", text: "SF:src/a.ts\nLF:4\nLH:4\nend_of_record\n" },
    });
    expect(r.testCoverage.lineRate).toBe(1);
  });
});

describe("dependency vulnerabilities, grouped and weighted", () => {
  const lock = JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": {},
      "node_modules/vite": { version: "5.4.21", dev: true },
      "node_modules/lodash": { version: "4.17.20" },
    },
  });
  const fetchImpl: OsvFetch = (url) => {
    if (url.endsWith("querybatch"))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [
              { vulns: [{ id: "GHSA-c" }] },
              { vulns: [{ id: "GHSA-a" }, { id: "GHSA-b" }] },
            ],
          }),
      });
    const id = url.split("/").pop();
    const name = id === "GHSA-c" ? "lodash" : "vite";
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id,
          summary: `issue ${id}`,
          aliases: [`CVE-${id}`],
          database_specific: { severity: "HIGH" },
          affected: [
            {
              package: { name, ecosystem: "npm" },
              ranges: [
                { events: [{ fixed: name === "vite" ? "6.4.4" : "4.17.21" }, { fixed: "9.9.9" }] },
              ],
            },
          ],
        }),
    });
  };
  it("recommends per package, with the nearest fix, update size and a note for development tools", async () => {
    const d = write({
      "package.json": '{ "name": "v" }',
      "package-lock.json": lock,
      "src/a.ts": "export {};\n",
    });
    const config = resolveConfig({ history: { enabled: false } });
    const r = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "local", location: "x", ref: null },
      historyRoot: null,
      osvFetch: fetchImpl,
    });
    const titles = r.recommendations.map((x) => x.title);
    expect(titles.some((t) => /Upgrade lodash to 4.17.21 \(fixes 1 advisory\)/.test(t))).toBe(true);
    const vite = r.recommendations.find((x) => /Upgrade vite/.test(x.title));
    expect(vite?.title).toMatch(
      /to 6\.4\.4 \(fixes 2 advisories, development tool only, major update\)/,
    );
    expect(vite?.effort).toBe("high");
    expect(r.recommendations.findIndex((x) => /lodash/.test(x.title))).toBeLessThan(
      r.recommendations.findIndex((x) => /vite/.test(x.title)),
    );
    const f = r.findings.find((x) => x.tags.includes("package:vite"));
    expect(f?.explanation).toMatch(/development-only/);
    expect(f?.explanation).toMatch(/CVE-/);
    expect(f?.remediation).toBe(
      "Upgrade vite from 5.4.21 to 6.4.4 (a major update that may need code changes).",
    );
    const sec = r.scores
      .find((s) => s.dimension === "security-hygiene")
      ?.inputs.find((i) => i.name === "vulnerable-dependency-weight");
    expect(sec?.raw).toBe(5 + 0.4 * 5 * 2);
  });
});

describe("remote activity without a clone", () => {
  it("fills history, commit quality and pull request signals from the GitHub API", async () => {
    const d = write({ "src/a.ts": "export {};\n" });
    const commits = Array.from({ length: 12 }, (_, i) => ({
      commit: {
        author: { name: i % 4 === 0 ? "Bo" : "Ana", date: `2024-0${1 + (i % 9)}-15T00:00:00Z` },
        message: i % 2 ? "update" : `feat: change number ${i}`,
      },
    }));
    const fetchImpl: JsonFetch = (url) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            url.includes("/commits")
              ? commits
              : url.includes("/pulls")
                ? [{ merged_at: "2024-01-02T00:00:00Z", created_at: "2024-01-01T00:00:00Z" }]
                : [],
          ),
      });
    const config = resolveConfig({ security: { offline: false, osv: false } });
    const r = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "github", location: "https://github.com/o/r", ref: null },
      historyRoot: null,
      activity: { owner: "o", repo: "r", ref: null, fetchImpl },
    });
    expect(r.history).toMatchObject({ available: true, source: "github-api", commitsAnalyzed: 12 });
    expect(r.history.pullRequests?.merged).toBe(1);
    const act = r.scores.find((s) => s.dimension === "maintenance-activity");
    expect(act?.state).toBe("assessed");
    expect(act?.coverage).toBe(0.6);
    expect(act?.confidence).toBe("medium");
    expect(r.history.hotspots).toEqual([]);
  });
  it("does not call the API in offline mode and says why", async () => {
    const d = write({ "src/a.ts": "export {};\n" });
    let called = false;
    const fetchImpl: JsonFetch = () => {
      called = true;
      return Promise.reject(new Error("no"));
    };
    const r = await run(
      d,
      { activity: { owner: "o", repo: "r", ref: null, fetchImpl } },
      { history: { enabled: true } },
    );
    expect(called).toBe(false);
    expect(r.history.reason).toMatch(/Offline mode/);
  });
});

describe("history in a real repository adds commit quality and file level risk", () => {
  it("uses churn in the risk index", async () => {
    const d = write(
      Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [`src/f${i}.ts`, `export const v${i} = ${i};\n`]),
      ),
    );
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "A",
      GIT_AUTHOR_EMAIL: "a@x.t",
      GIT_COMMITTER_NAME: "A",
      GIT_COMMITTER_EMAIL: "a@x.t",
    };
    const g = (...a: string[]) => execFileSync("git", a, { cwd: d, env, stdio: "ignore" });
    g("init", "-q", "-b", "main");
    g("add", ".");
    g("commit", "-q", "-m", "feat: initial files");
    for (let i = 0; i < 4; i++) {
      writeFileSync(join(d, "src/f2.ts"), `export const v2 = ${100 + i};\n`);
      g("commit", "-q", "-am", i % 2 ? "update" : `fix: tweak value ${i}`);
    }
    const config = resolveConfig({ security: { offline: true } });
    const r = await analyze({
      config,
      workspace: openLocalWorkspace(d, config),
      source: { type: "local", location: d, ref: null },
      historyRoot: d,
    });
    expect(r.history.source).toBe("git");
    expect(r.history.commitQuality?.sampled).toBe(5);
    const top = r.risk.files[0];
    expect(top?.path).toBe("src/f2.ts");
    expect(top?.factors.find((f) => f.name === "churn")?.value).toBe(5);
  });
});
