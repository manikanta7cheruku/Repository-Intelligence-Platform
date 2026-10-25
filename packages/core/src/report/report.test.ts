import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openLocalWorkspace } from "../acquire/local.js";
import { resolveConfig } from "../config/config.js";
import { analyze } from "../pipeline/analyze.js";
import type { Report } from "../ir/types.js";
import { diffReports, diffToMarkdown } from "./diff.js";
import { toHtml } from "./html.js";
import { toMarkdown } from "./markdown.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures");
let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const gen = async (dir: string): Promise<Report> => {
  const config = resolveConfig({ security: { offline: true }, history: { enabled: false } });
  return analyze({ config, workspace: openLocalWorkspace(dir, config), source: { type: "local", location: "fx", ref: null, name: "fx" }, historyRoot: null });
};
const hostile = async (): Promise<Report> => {
  const d = mkdtempSync(join(tmpdir(), "rl-host-"));
  dirs.push(d);
  mkdirSync(join(d, ".github/workflows"), { recursive: true });
  mkdirSync(join(d, "src"), { recursive: true });
  writeFileSync(join(d, ".github/workflows/x.yml"), "name: x\non: push\njobs:\n  a:\n    steps:\n      - uses: evil/<script>alert(1)</script>@v1\n      - uses: \"x/y|z\"@v1\n");
  writeFileSync(join(d, "src", "a<b>\"c'd&e|f.ts"), "export const a = 1;\n");
  writeFileSync(join(d, "package.json"), '{ "name": "<img src=x onerror=alert(1)>" }');
  return gen(d);
};

describe("HTML report", () => {
  it("escapes hostile content, ships a strict CSP and contains no script elements (T-12, SA-06, SA-07)", async () => {
    const r = await hostile();
    const html = toHtml(r);
    expect(/<script/i.test(html)).toBe(false);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/https?:\/\/[^"' <]*\.(js|css)/);
  });
  it("is self-contained, labels partial reports, and shows not assessed instead of zero", async () => {
    const r = await gen(join(FIXTURES, "unsupported-only"));
    const html = toHtml(r);
    expect(html).toContain("not-assessed");
    expect(html).toContain("n/a");
    expect(html).toContain("<h2 id=\"findings\">");
    expect(html).not.toMatch(/\bhref="https?:/);
  });
});

describe("Markdown report", () => {
  it("escapes table separators and contains every required section", async () => {
    const md = toMarkdown(await hostile());
    for (const h of ["## Executive summary", "## Scores", "### How to improve each score", "## Scope and coverage", "## Architecture", "## Risk and blast radius", "## Code quality", "## Security", "## Git history", "## Findings", "## Methodology", "## Glossary", "## Limitations", "## Reproducibility"]) expect(md).toContain(h);
    expect(md).not.toContain("<script>");
    expect(md).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(md).not.toContain("<img src=x");
  });
  it("states that findings do not imply security and that not assessed is not zero", async () => {
    const md = toMarkdown(await gen(join(FIXTURES, "ts-layered-clean")));
    expect(md).toMatch(/do not show that the repository is secure/);
    expect(md).toMatch(/Not assessed means the inputs were missing, not that the value is zero/);
  });
  it("never uses em dashes in generated output", async () => {
    const r = await gen(join(FIXTURES, "ts-violation"));
    for (const text of [toMarkdown(r), toHtml(r), JSON.stringify(r)]) expect(text.includes("\u2014")).toBe(false);
  });
  it("lists findings with id, evidence, location and remediation", async () => {
    const r = await gen(join(FIXTURES, "ts-cycle"));
    const md = toMarkdown(r);
    const f = r.findings.find((x) => x.ruleId === "arch.cycle.file");
    expect(md).toContain(`#### ${f?.title}`);
    expect(md).toContain(`Id: ${f?.id}`);
    expect(md).toContain("Remediation:");
    expect(md).toContain("Evidence: graph-path");
  });
});

describe("diffReports", () => {
  it("detects added and removed edges, new findings and score deltas, and keeps missing values null", async () => {
    const a = await gen(join(FIXTURES, "ts-layered-clean"));
    const b = await gen(join(FIXTURES, "ts-cycle"));
    const d = diffReports(a, b);
    expect(d.edges.added.length).toBeGreaterThan(0);
    expect(d.edges.removed.length).toBeGreaterThan(0);
    expect(d.findings.added.length).toBeGreaterThan(0);
    expect(d.scores.find((s) => s.dimension === "maintenance-activity")).toMatchObject({ from: null, to: null, delta: null });
    expect(diffToMarkdown(d)).toContain("# RepoLens comparison");
    const same = diffReports(a, a);
    expect(same.findings.added).toEqual([]);
    expect(same.edges.added).toEqual([]);
    expect(same.scores.every((s) => s.delta === 0 || s.delta === null)).toBe(true);
  });
});
