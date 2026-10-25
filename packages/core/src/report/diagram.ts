import type { Report } from "../ir/types.js";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const q = (s: string): string => s.replace(/"/g, "'").replace(/[\r\n]+/g, " ");

interface ModNode {
  id: string;
  path: string;
  files: number;
  loc: number;
  level: number;
  inCycle: boolean;
}

function moduleModel(r: Report, limit = 60): { nodes: ModNode[]; edges: { from: string; to: string; weight: number; cycle: boolean }[]; hidden: number } {
  const levels = new Map(r.graph.levels.map((l) => [l.moduleId, l.level]));
  const cycleMods = new Set(r.graph.cycles.filter((c) => c.scope === "module").flatMap((c) => c.members));
  const all: ModNode[] = r.graph.modules.map((m) => ({ id: m.id, path: m.path, files: m.fileCount, loc: m.loc, level: levels.get(m.id) ?? 0, inCycle: cycleMods.has(m.path) }));
  const keep = [...all].sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path)).slice(0, limit);
  const keepIds = new Set(keep.map((n) => n.id));
  const nodes = keep.sort((a, b) => b.level - a.level || a.path.localeCompare(b.path));
  const byId = new Map(all.map((n) => [n.id, n]));
  const edges = r.graph.moduleEdges.filter((e) => keepIds.has(e.from) && keepIds.has(e.to)).map((e) => ({ from: e.from, to: e.to, weight: e.weight, cycle: (byId.get(e.from)?.inCycle ?? false) && (byId.get(e.to)?.inCycle ?? false) }));
  return { nodes, edges, hidden: all.length - keep.length };
}

/** Mermaid flowchart of the module graph. Paste into any Mermaid renderer. */
export function toMermaid(r: Report): string {
  const { nodes, edges, hidden } = moduleModel(r);
  const idx = new Map(nodes.map((n, i) => [n.id, `m${i}`]));
  const lines = ["flowchart LR"];
  for (const n of nodes) lines.push(`  ${idx.get(n.id)}["${q(n.path)}<br/>${n.files} files, ${n.loc} lines"]`);
  for (const e of edges) lines.push(`  ${idx.get(e.from)} -->|${e.weight}| ${idx.get(e.to)}`);
  const cyc = nodes.filter((n) => n.inCycle).map((n) => idx.get(n.id));
  if (cyc.length > 0) {
    lines.push("  classDef cycle stroke:#b3261e,stroke-width:2px");
    lines.push(`  class ${cyc.join(",")} cycle`);
  }
  if (hidden > 0) lines.push(`  %% ${hidden} smaller modules are not shown`);
  return `${lines.join("\n")}\n`;
}

/** Graphviz DOT of the module graph. */
export function toDot(r: Report): string {
  const { nodes, edges, hidden } = moduleModel(r);
  const idx = new Map(nodes.map((n, i) => [n.id, `m${i}`]));
  const lines = ["digraph repolens {", "  rankdir=LR;", '  node [shape=box, fontname="Helvetica", fontsize=11];'];
  for (const n of nodes) lines.push(`  ${idx.get(n.id)} [label="${q(n.path)}\\n${n.files} files, ${n.loc} lines"${n.inCycle ? ', color="#b3261e", penwidth=2' : ""}];`);
  for (const e of edges) lines.push(`  ${idx.get(e.from)} -> ${idx.get(e.to)} [label="${e.weight}"${e.cycle ? ', color="#b3261e"' : ""}];`);
  if (hidden > 0) lines.push(`  // ${hidden} smaller modules are not shown`);
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

const trunc = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.ceil(n / 2) - 1)}...${s.slice(s.length - Math.floor(n / 2) + 2)}`);

/** Self-contained SVG of the module graph: columns are dependency levels, arrows point to what a module depends on. */
export function toSvg(r: Report): string {
  const { nodes, edges, hidden } = moduleModel(r);
  const W = 210, H = 46, GX = 90, GY = 18, PAD = 24;
  const levels = [...new Set(nodes.map((n) => n.level))].sort((a, b) => b - a);
  const col = new Map(levels.map((l, i) => [l, i]));
  const rows = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const c = col.get(n.level) as number;
    const row = rows.get(c) ?? 0;
    rows.set(c, row + 1);
    pos.set(n.id, { x: PAD + c * (W + GX), y: PAD + 20 + row * (H + GY) });
  }
  const width = PAD * 2 + Math.max(1, levels.length) * W + Math.max(0, levels.length - 1) * GX;
  const height = PAD * 2 + 40 + Math.max(1, ...rows.values()) * (H + GY);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d" font-family="system-ui, -apple-system, Segoe UI, sans-serif">`);
  out.push(`<title id="t">Module dependency graph of ${esc(r.repository.name)}</title>`);
  out.push(`<desc id="d">${nodes.length} modules in ${levels.length} dependency levels. Arrows point from a module to the modules it depends on. Modules in a cycle are outlined in red.${hidden > 0 ? ` ${hidden} smaller modules are not shown.` : ""}</desc>`);
  out.push("<style>:root{--bg:#fff;--box:#f6f7f9;--line:#8a93a3;--text:#14171f;--muted:#4a5160;--bad:#b3261e}@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--box:#151a22;--line:#6b7587;--text:#e6e9ef;--muted:#b4bbc8;--bad:#ff7b72}}rect.bg{fill:var(--bg)}rect.n{fill:var(--box);stroke:var(--line)}rect.n.c{stroke:var(--bad);stroke-width:2}text{fill:var(--text);font-size:12px}text.s{fill:var(--muted);font-size:11px}path.e{fill:none;stroke:var(--line);stroke-width:1.2}path.e.c{stroke:var(--bad);stroke-dasharray:5 3}</style>");
  out.push(`<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8a93a3"/></marker></defs>`);
  out.push(`<rect class="bg" width="${width}" height="${height}"/>`);
  levels.forEach((l, i) => out.push(`<text class="s" x="${PAD + i * (W + GX)}" y="${PAD + 8}">${l === 0 ? "Level 0: depends on nothing" : `Level ${l}`}</text>`));
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const forward = b.x > a.x;
    const x1 = forward ? a.x + W : a.x;
    const x2 = forward ? b.x : b.x + W;
    const y1 = a.y + H / 2, y2 = b.y + H / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    const c1 = forward ? x1 + dx : x1 - dx, c2 = forward ? x2 - dx : x2 + dx;
    const same = a.x === b.x;
    const path = same ? `M${a.x + W},${y1} C${a.x + W + 50},${y1} ${b.x + W + 50},${y2} ${b.x + W},${y2}` : `M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`;
    out.push(`<path class="e${e.cycle ? " c" : ""}" d="${path}" marker-end="url(#a)"><title>${esc(`${nodes.find((n) => n.id === e.from)?.path} depends on ${nodes.find((n) => n.id === e.to)?.path} (${e.weight} imports)`)}</title></path>`);
  }
  for (const n of nodes) {
    const p = pos.get(n.id) as { x: number; y: number };
    out.push(`<g><title>${esc(`${n.path}: ${n.files} files, ${n.loc} lines${n.inCycle ? ", in a cycle" : ""}`)}</title><rect class="n${n.inCycle ? " c" : ""}" x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="4"/><text x="${p.x + 10}" y="${p.y + 19}">${esc(trunc(n.path, 30))}</text><text class="s" x="${p.x + 10}" y="${p.y + 35}">${n.files} files, ${n.loc} lines</text></g>`);
  }
  out.push("</svg>");
  return `${out.join("\n")}\n`;
}

/** Mermaid graph of the files inside one module and their direct neighbors, for drill-down. */
export function toMermaidFiles(r: Report, modulePath: string): string | null {
  const mod = r.graph.modules.find((m) => m.path === modulePath);
  if (!mod) return null;
  const inMod = new Set(r.graph.nodes.filter((n) => n.moduleId === mod.id).map((n) => n.id));
  const byId = new Map(r.graph.nodes.map((n) => [n.id, n]));
  const edges = r.graph.edges.filter((e) => inMod.has(e.from) || inMod.has(e.to)).slice(0, 200);
  const ids = [...new Set(edges.flatMap((e) => [e.from, e.to]).concat([...inMod]))];
  const idx = new Map(ids.map((id, i) => [id, `f${i}`]));
  const lines = ["flowchart LR"];
  for (const id of ids) lines.push(`  ${idx.get(id)}["${q((byId.get(id)?.path ?? id).split("/").slice(-3).join("/"))}"]${inMod.has(id) ? "" : ":::outside"}`);
  for (const e of edges) lines.push(`  ${idx.get(e.from)} ${e.typeOnly ? "-.->" : "-->"} ${idx.get(e.to)}`);
  lines.push("  classDef outside stroke-dasharray:4 3,color:#6b7587");
  return `${lines.join("\n")}\n`;
}
