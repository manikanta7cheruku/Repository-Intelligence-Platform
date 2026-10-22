import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT, runCli, type Io } from "./main.js";

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
    expect(json.schemaVersion).toBe("0.1.0");
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
