import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT, type Io, runCli } from "./main.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "fixtures");
let dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rl-cli-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
async function cli(args: string[], cwd = tmp()) {
  let out = "";
  let err = "";
  const io: Io = {
    out: (s) => {
      out += s;
    },
    err: (s) => {
      err += s;
    },
    cwd,
    env: {},
    isTty: false,
  };
  const code = await runCli(args, io);
  return { code, out, err, cwd };
}

describe("repolens CLI", () => {
  it("prints help, version and fails with a usage code when called with nothing", async () => {
    expect((await cli(["--help"])).out).toContain("Usage:");
    expect((await cli(["--version"])).out).toMatch(/^\d+\.\d+\.\d+/);
    expect((await cli([])).code).toBe(EXIT.USAGE);
  });
  it("analyzes a local repository and writes json and markdown by default", async () => {
    const r = await cli(["analyze", join(FIXTURES, "ts-layered-clean"), "--offline", "-o", "out"]);
    expect(r.code).toBe(EXIT.OK);
    const json = JSON.parse(readFileSync(join(r.cwd, "out", "report.json"), "utf8"));
    expect(json.schemaVersion).toBe("0.4.0");
    expect(existsSync(join(r.cwd, "out", "report.md"))).toBe(true);
    expect(existsSync(join(r.cwd, "out", "report.html"))).toBe(false);
    expect(r.out).toContain("RepoLens");
  });
  it("writes only the requested formats and supports --stdout for pipes", async () => {
    const r = await cli([
      "analyze",
      join(FIXTURES, "ts-cycle"),
      "--offline",
      "-f",
      "html",
      "-o",
      "o",
    ]);
    expect(existsSync(join(r.cwd, "o", "report.html"))).toBe(true);
    expect(existsSync(join(r.cwd, "o", "report.json"))).toBe(false);
    const s = await cli([
      "analyze",
      join(FIXTURES, "ts-cycle"),
      "--offline",
      "--stdout",
      "--no-history",
    ]);
    expect(JSON.parse(s.out).status).toBe("complete");
    expect(s.err).toContain("RepoLens");
  });
  it("exits 1 when architecture rules are violated and 0 after the violations are baselined", async () => {
    const cwd = tmp();
    const bad = await cli(
      [
        "analyze",
        join(FIXTURES, "ts-violation"),
        "--offline",
        "-o",
        "o",
        "--write-baseline",
        "base.json",
      ],
      cwd,
    );
    expect(bad.code).toBe(EXIT.OK);
    const ids = JSON.parse(readFileSync(join(cwd, "base.json"), "utf8")).accepted as string[];
    expect(ids.length).toBeGreaterThan(0);
    expect(
      (await cli(["analyze", join(FIXTURES, "ts-violation"), "--offline", "-o", "o"], cwd)).code,
    ).toBe(EXIT.POLICY);
    expect(
      (
        await cli(
          [
            "analyze",
            join(FIXTURES, "ts-violation"),
            "--offline",
            "-o",
            "o",
            "--baseline",
            "base.json",
          ],
          cwd,
        )
      ).code,
    ).toBe(EXIT.OK);
  });
  it("supports --fail-on thresholds", async () => {
    expect(
      (
        await cli([
          "analyze",
          join(FIXTURES, "ts-cycle"),
          "--offline",
          "-q",
          "-o",
          "o",
          "--fail-on",
          "medium",
        ])
      ).code,
    ).toBe(EXIT.POLICY);
    expect(
      (
        await cli([
          "analyze",
          join(FIXTURES, "ts-cycle"),
          "--offline",
          "-q",
          "-o",
          "o",
          "--fail-on",
          "critical",
        ])
      ).code,
    ).toBe(EXIT.OK);
  });
  it("returns 4 for partial results only when asked", async () => {
    const args = [
      "analyze",
      join(FIXTURES, "ts-layered-clean"),
      "--offline",
      "-q",
      "-o",
      "o",
      "--config",
      "cfg.json",
    ];
    const cwd = tmp();
    writeFileSync(join(cwd, "cfg.json"), JSON.stringify({ budgets: { maxFiles: 3 } }));
    expect((await cli(args, cwd)).code).toBe(EXIT.OK);
    expect((await cli([...args, "--fail-on-partial"], cwd)).code).toBe(EXIT.PARTIAL);
  });
  it("returns usage errors (2) for bad input without a stack trace", async () => {
    for (const args of [
      ["analyze"],
      ["analyze", "a", "b"],
      ["analyze", ".", "--bogus"],
      ["analyze", ".", "-f", "pdf"],
      ["analyze", ".", "--fail-on", "urgent"],
      ["analyze", "https://evil.com/x/y"],
      ["nope"],
      ["report"],
      ["diff", "a"],
    ]) {
      const r = await cli(args);
      expect(r.code).toBe(EXIT.USAGE);
      expect(r.err).not.toMatch(/\n\s+at /);
    }
  });
  it("returns usage errors for invalid config and invalid rules files", async () => {
    const cwd = tmp();
    writeFileSync(join(cwd, "cfg.json"), '{ "nope": 1 }');
    writeFileSync(join(cwd, "rules.yaml"), "version: 9");
    const target = join(FIXTURES, "ts-cycle");
    expect((await cli(["analyze", target, "--offline", "--config", "cfg.json"], cwd)).code).toBe(
      EXIT.USAGE,
    );
    const r = await cli(["analyze", target, "--offline", "--rules", "rules.yaml"], cwd);
    expect(r.code).toBe(EXIT.USAGE);
    expect(r.err).toMatch(/version: 1/);
  });
  it("returns 3 when the path does not exist", async () => {
    const r = await cli(["analyze", "/definitely/not/here", "--offline"]);
    expect(r.code).toBe(EXIT.ERROR);
    expect(r.err).toContain("does not exist");
  });
  it("converts a saved report and compares two reports", async () => {
    const cwd = tmp();
    await cli(["analyze", join(FIXTURES, "ts-layered-clean"), "--offline", "-q", "-o", "a"], cwd);
    await cli(["analyze", join(FIXTURES, "ts-cycle"), "--offline", "-q", "-o", "b"], cwd);
    const html = await cli(["report", "a/report.json", "--format", "html"], cwd);
    expect(html.code).toBe(EXIT.OK);
    expect(html.out).toContain("<!doctype html>");
    const diff = await cli(["diff", "a/report.json", "b/report.json"], cwd);
    expect(diff.out).toContain("# RepoLens comparison");
    expect(
      JSON.parse((await cli(["diff", "a/report.json", "b/report.json", "-f", "json"], cwd)).out)
        .edges.added.length,
    ).toBeGreaterThan(0);
    mkdirSync(join(cwd, "bad"));
    writeFileSync(join(cwd, "bad", "r.json"), "{}");
    expect((await cli(["report", "bad/r.json"], cwd)).code).toBe(EXIT.USAGE);
  });
  it("prints the report JSON schema", async () => {
    const r = await cli(["schema"]);
    expect(JSON.parse(r.out).title).toBe("RepoLens report");
  });
  it("auto-detects repolens.rules.yaml in the analyzed directory", async () => {
    const r = await cli(["analyze", join(FIXTURES, "ts-violation"), "--offline", "-q", "--stdout"]);
    expect(JSON.parse(r.out).rules.evaluated).toBe(true);
  });
});

const gitIn = (cwd: string, ...a: string[]) =>
  execFileSync("git", a, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "T",
      GIT_AUTHOR_EMAIL: "t@x.t",
      GIT_COMMITTER_NAME: "T",
      GIT_COMMITTER_EMAIL: "t@x.t",
    },
  });

describe("repolens CLI, Phase 1.5 commands", () => {
  it("ingests a coverage report passed with --coverage", async () => {
    const cwd = tmp();
    writeFileSync(join(cwd, "lcov.info"), "SF:src/core/util.ts\nLF:4\nLH:3\nend_of_record\n");
    const r = await cli(
      [
        "analyze",
        join(FIXTURES, "ts-blast-radius"),
        "--offline",
        "-q",
        "--stdout",
        "--coverage",
        "lcov.info",
      ],
      cwd,
    );
    expect(JSON.parse(r.out).testCoverage).toMatchObject({ ingested: true, lineRate: 0.75 });
    expect(
      (
        await cli(
          ["analyze", join(FIXTURES, "ts-blast-radius"), "--offline", "--coverage", "missing.info"],
          cwd,
        )
      ).code,
    ).toBe(EXIT.USAGE);
  });
  it("explains the blast radius of a file from a saved report", async () => {
    const cwd = tmp();
    await cli(["analyze", join(FIXTURES, "ts-blast-radius"), "--offline", "-q", "-o", "a"], cwd);
    const r = await cli(["impact", "a/report.json", "src/core/util.ts"], cwd);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain("Direct dependents: 3");
    expect(r.out).toContain("All dependents (direct and indirect): 4");
    expect(r.out).toContain("src/index.ts");
    expect(
      JSON.parse(
        (await cli(["impact", "a/report.json", "src/core/util.ts", "-f", "json"], cwd)).out,
      ).transitiveDependents,
    ).toBe(4);
    const bad = await cli(["impact", "a/report.json", "util.ts"], cwd);
    expect(bad.code).toBe(EXIT.USAGE);
    expect(bad.err).toContain("Did you mean: src/core/util.ts");
    expect((await cli(["impact", "a/report.json"], cwd)).code).toBe(EXIT.USAGE);
  });
  it("exports diagrams in three formats and a file level drill-down", async () => {
    const cwd = tmp();
    await cli(["analyze", join(FIXTURES, "ts-layered-clean"), "--offline", "-q", "-o", "a"], cwd);
    expect((await cli(["graph", "a/report.json"], cwd)).out.startsWith("flowchart LR")).toBe(true);
    expect((await cli(["graph", "a/report.json", "-f", "dot"], cwd)).out).toContain("digraph");
    expect((await cli(["graph", "a/report.json", "-f", "svg", "-o", "g.svg"], cwd)).code).toBe(
      EXIT.OK,
    );
    expect(readFileSync(join(cwd, "g.svg"), "utf8")).toContain("<svg");
    expect((await cli(["graph", "a/report.json", "--module", "src/domain"], cwd)).out).toContain(
      "service.ts",
    );
    expect((await cli(["graph", "a/report.json", "--module", "nope"], cwd)).code).toBe(EXIT.USAGE);
    expect((await cli(["graph", "a/report.json", "-f", "png"], cwd)).code).toBe(EXIT.USAGE);
  });
  it("prints glossary entries for humans and as JSON", async () => {
    const one = await cli(["glossary", "file-cycle-ratio"]);
    expect(one.out).toContain("Files in circular dependencies");
    expect(one.out).toContain("How to improve:");
    expect(JSON.parse((await cli(["glossary", "-f", "json"])).out).entries.length).toBeGreaterThan(
      40,
    );
    expect((await cli(["glossary", "nope"])).code).toBe(EXIT.USAGE);
  });
  it("compares two saved reports as a pull request check and can fail on regression", async () => {
    const cwd = tmp();
    await cli(
      ["analyze", join(FIXTURES, "ts-layered-clean"), "--offline", "-q", "-o", "base"],
      cwd,
    );
    await cli(["analyze", join(FIXTURES, "ts-violation"), "--offline", "-q", "-o", "head"], cwd);
    const r = await cli(
      ["pr", "--base-report", "base/report.json", "--head-report", "head/report.json"],
      cwd,
    );
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain("Architecture regressed");
    expect(
      (
        await cli(
          [
            "pr",
            "--base-report",
            "base/report.json",
            "--head-report",
            "head/report.json",
            "--fail-on-regression",
          ],
          cwd,
        )
      ).code,
    ).toBe(EXIT.POLICY);
    expect(
      JSON.parse(
        (
          await cli(
            [
              "pr",
              "--base-report",
              "base/report.json",
              "--head-report",
              "head/report.json",
              "-f",
              "json",
            ],
            cwd,
          )
        ).out,
      ).verdict,
    ).toBe("regressed");
    expect((await cli(["pr", "--base-report", "base/report.json"], cwd)).code).toBe(EXIT.USAGE);
    expect((await cli(["pr"], cwd)).code).toBe(EXIT.USAGE);
  });
  it("checks a pull request straight from Git branches", async () => {
    const d = tmp();
    cpSync(join(FIXTURES, "ts-layered-clean"), d, { recursive: true });
    gitIn(d, "init", "-q", "-b", "main");
    gitIn(d, "add", ".");
    gitIn(d, "commit", "-q", "-m", "base");
    gitIn(d, "switch", "-q", "-c", "feature");
    writeFileSync(
      join(d, "src/domain/service.ts"),
      'import { render } from "../ui/app";\nexport class Service { run(): string { return render(); } }\nexport function start(): void { new Service(); }\n',
    );
    gitIn(d, "commit", "-q", "-am", "domain uses ui");
    const r = await cli(
      ["pr", "--base", "main", "--head", "feature", "-q", "--fail-on-regression"],
      d,
    );
    expect(r.code).toBe(EXIT.POLICY);
    expect(r.out).toContain("Architecture regressed");
    expect(r.out).toContain("src/domain/service.ts");
    const wt = await cli(["pr", "--base", "main", "-q"], d);
    expect(wt.out).toContain("Architecture regressed");
    expect((await cli(["pr", "--base", "--bad"], d)).code).toBe(EXIT.USAGE);
    expect((await cli(["pr", "--base", "no-such-branch", "-q"], d)).code).toBe(EXIT.ERROR);
  });
  it("shows how a repository changed across its history", async () => {
    const d = tmp();
    mkdirSync(join(d, "src"));
    gitIn(d, "init", "-q", "-b", "main");
    for (let i = 0; i < 4; i++) {
      writeFileSync(
        join(d, "src", `f${i}.ts`),
        `${i ? `import { v${i - 1} } from "./f${i - 1}";\n` : ""}export const v${i} = ${i};\n`,
      );
      gitIn(d, "add", ".");
      gitIn(d, "commit", "-q", "-m", `feat: add f${i}`);
    }
    const r = await cli(["trend", "--points", "3", "-q"], d);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain("# RepoLens trend: HEAD");
    expect(
      JSON.parse((await cli(["trend", "--points", "2", "-q", "-f", "json"], d)).out).points,
    ).toHaveLength(2);
    expect((await cli(["trend", "--points", "99"], d)).code).toBe(EXIT.USAGE);
    expect((await cli(["trend", "--ref", "--all", "-q"], d)).code).toBe(EXIT.USAGE);
  });
});
