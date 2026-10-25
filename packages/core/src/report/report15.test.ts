import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openLocalWorkspace } from "../acquire/local.js";
import { resolveConfig } from "../config/config.js";
import type { Report } from "../ir/types.js";
import { analyze } from "../pipeline/analyze.js";
import { toDot, toMermaid, toMermaidFiles, toSvg } from "./diagram.js";
import { toHtml } from "./html.js";
import { toMarkdown } from "./markdown.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures");
const gen = async (name: string): Promise<Report> => {
  const config = resolveConfig({ security: { offline: true }, history: { enabled: false } });
  const dir = join(FIXTURES, name);
  return analyze({
    config,
    workspace: openLocalWorkspace(dir, config),
    source: { type: "local", location: name, ref: null, name },
    historyRoot: null,
  });
};

describe("explanations in reports", () => {
  it("HTML explains technical terms on hover and includes a glossary, an executive summary and a module map", async () => {
    const html = toHtml(await gen("ts-cycle"));
    expect(html).toContain('<abbr tabindex="0" title="');
    expect(html).toContain("The share of files that are stuck in a loop");
    expect(html).toContain('<h2 id="glossary">Glossary</h2>');
    expect(html).toContain("Executive summary");
    expect(html).toContain("<svg");
    expect(html).toContain("How to improve each score");
    expect(/<script/i.test(html)).toBe(false);
    expect(html.includes("\u2014")).toBe(false);
  });
  it("Markdown has the executive summary, improvement table, mermaid map, risk and blast radius sections", async () => {
    const md = toMarkdown(await gen("ts-blast-radius"));
    expect(md).toContain("```mermaid");
    expect(md).toContain("## Risk and blast radius");
    expect(md).toMatch(/\| src\/core\/util\.ts \| 3 \| 4 \|/);
    expect(md).toContain("Points to gain");
    expect(md).toContain("Testing and CI");
    expect(md).not.toContain("Testing ci");
    expect(md).toMatch(/Inputs used/);
  });
  it("says what is missing to enable a not-assessed score", async () => {
    const md = toMarkdown(await gen("unsupported-only"));
    expect(md).toMatch(/Architecture is not assessed\. To enable it:/);
    expect(md).toContain("n/a (detection only)");
  });
});

describe("diagram exports", () => {
  it("exports Mermaid, DOT and SVG of the module graph and marks cycles", async () => {
    const r = await gen("ts-cycle");
    const m = toMermaid(r);
    expect(m.startsWith("flowchart LR")).toBe(true);
    expect(m).toContain("classDef cycle");
    expect(m).toContain("src/x");
    const d = toDot(r);
    expect(d).toContain("digraph repolens");
    expect(d).toContain('color="#b3261e"');
    const svg = toSvg(r);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title");
    expect(svg).toContain("prefers-color-scheme:dark");
    expect((svg.match(/<rect class="n/g) ?? []).length).toBe(r.graph.modules.length);
  });
  it("escapes hostile module names in every format", async () => {
    const r = await gen("ts-layered-clean");
    const evil = {
      ...r,
      graph: {
        ...r.graph,
        modules: r.graph.modules.map((m, i) =>
          i === 0 ? { ...m, path: 'x"><script>alert(1)</script>' } : m,
        ),
      },
    };
    const svg = toSvg(evil);
    expect(svg).not.toContain("<script>alert(1)");
    expect(svg).toContain("&lt;script&gt;");
    expect(toMermaid(evil)).not.toContain('"><script>');
    expect(toDot(evil)).not.toContain('"><script>');
  });
  it("exports a file level drill-down for one module and returns null for an unknown module", async () => {
    const r = await gen("ts-layered-clean");
    const files = toMermaidFiles(r, "src/domain");
    expect(files).toContain("service.ts");
    expect(files).toContain(":::outside");
    expect(toMermaidFiles(r, "nope")).toBeNull();
  });
  it("limits very large graphs and says how many modules were left out", async () => {
    const r = await gen("ts-layered-clean");
    const many = {
      ...r,
      graph: {
        ...r.graph,
        modules: Array.from({ length: 70 }, (_, i) => ({
          ...(r.graph.modules[0] as Report["graph"]["modules"][number]),
          id: `m_${i}`,
          path: `mod/${i}`,
          loc: 100 - i,
        })),
        moduleEdges: [],
        levels: [],
      },
    };
    expect(toMermaid(many)).toContain("10 smaller modules are not shown");
  });
});
