import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GLOSSARY, validateReport } from "@repolens/core/browser";
import { describe, expect, it } from "vitest";
import { POST } from "../app/api/analyze/route";
import { layerOf, layoutGraph, NODE_H } from "./layout";
import { buildExportSvg, chartCss, EXPORT_PALETTE } from "./svg";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");
const sample = JSON.parse(readFileSync(join(webRoot, "public", "sample", "report.json"), "utf8"));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("report contract", () => {
  it("the bundled sample report validates against the schema the web app reads", () => {
    const v = validateReport(sample);
    expect(v.issues).toEqual([]);
    expect(v.valid).toBe(true);
    expect(sample.schemaVersion).toBe("0.4.0");
  });
  it("every score carries the proof fields the briefing renders", () => {
    for (const s of sample.scores) {
      expect(typeof s.basis).toBe("string");
      for (const i of s.inputs) {
        expect(i).toHaveProperty("description");
        expect(i).toHaveProperty("curve");
        expect(i).toHaveProperty("contribution");
        expect(Array.isArray(i.evidence)).toBe(true);
      }
    }
  });
  it("the sample does not leak a local path or an author name", () => {
    const text = JSON.stringify(sample);
    expect(text).not.toMatch(/[A-Z]:\\Users/);
    expect(sample.repository.source.location).toMatch(/^https:\/\/github\.com\//);
  });
  it("every glossary term used in the interface exists", () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    const used = new Set<string>();
    for (const f of sourceFiles(join(webRoot, "src"))) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/<Term\s+id="([^"]+)"/g)) used.add(m[1] as string);
    }
    const missing = [...used].filter((u) => !ids.has(u));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(5);
  });
  it("uses no em dashes in the interface source", () => {
    for (const f of sourceFiles(join(webRoot, "src"))) {
      expect(readFileSync(f, "utf8").includes("\u2014"), f).toBe(false);
    }
  });
});

describe("graph layout", () => {
  const nodes = ["a", "b", "c", "d"].map((id) => ({ id, label: id }));
  it("puts importers left of what they import", () => {
    const l = layerOf(
      ["a", "b", "c"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    );
    expect(l.get("a")).toBe(0);
    expect(l.get("b")).toBe(1);
    expect(l.get("c")).toBe(2);
  });
  it("terminates on cycles and still places every node once", () => {
    const layout = layoutGraph(nodes, [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
      { from: "c", to: "d" },
    ]);
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(4);
  });
  it("never overlaps two nodes in the same column", () => {
    const layout = layoutGraph(
      Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, label: `n${i}` })),
      Array.from({ length: 29 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
    );
    const byCol = new Map<number, number[]>();
    for (const n of layout.nodes) byCol.set(n.x, [...(byCol.get(n.x) ?? []), n.y]);
    for (const ys of byCol.values()) {
      const sorted = [...ys].sort((p, q) => p - q);
      for (let i = 1; i < sorted.length; i++)
        expect((sorted[i] as number) - (sorted[i - 1] as number)).toBeGreaterThanOrEqual(NODE_H);
    }
  });
  it("is deterministic", () => {
    const e = [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
      { from: "c", to: "d" },
    ];
    expect(layoutGraph(nodes, e)).toEqual(layoutGraph(nodes, e));
  });
});

describe("export", () => {
  it("uses literal light colors, no CSS variables, and escapes hostile text", () => {
    expect(chartCss(EXPORT_PALETTE)).not.toContain("var(--");
    const svg = buildExportSvg("<g/>", 400, 200, {
      title: "<script>alert(1)</script>",
      repo: 'a"b&c',
      commit: "1234567890",
      date: "25 Oct 2026",
      tool: "RepoLens 0.1.0",
      legend: ["x"],
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("commit 1234567");
    expect(svg).toContain('fill="#FFFFFF"');
  });
});

describe("analyze route", () => {
  const call = (body: unknown, ip = "10.0.0.1") =>
    POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  it("refuses anything that is not a public github.com repository URL", async () => {
    for (const url of [
      "https://github.com.evil.com/a/b",
      "http://github.com/a/b",
      "https://127.0.0.1/a/b",
      "https://user:pw@github.com/a/b",
      "file:///etc/passwd",
      "not a url",
    ]) {
      const r = await call({ url }, `10.1.0.${Math.floor(Math.random() * 200)}`);
      expect(r.status, url).toBe(400);
    }
  });
  it("rejects malformed and oversized bodies", async () => {
    expect((await call("{not json", "10.2.0.1")).status).toBe(400);
    expect(
      (await call({ url: `https://github.com/a/${"b".repeat(3000)}` }, "10.2.0.2")).status,
    ).toBe(400);
    expect((await call({}, "10.2.0.3")).status).toBe(400);
  });
  it("rate limits repeated requests from one address, and not local use", async () => {
    process.env.RIP_MAX_ANALYSES_PER_10_MIN = "5";
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await call({ url: "bad" }, "10.3.0.1")).status);
    expect(codes).toContain(429);
    const local: number[] = [];
    for (let i = 0; i < 8; i++)
      local.push(
        (await POST(new Request("http://localhost/api/analyze", { method: "POST", body: "{}" })))
          .status,
      );
    expect(local).not.toContain(429);
    process.env.RIP_MAX_ANALYSES_PER_10_MIN = undefined;
  });
});
