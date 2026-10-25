/** Layered (left to right) graph layout. Importers sit left of what they import. Deterministic. */

export interface GNode {
  id: string;
  label: string;
  sub?: string;
  /** Free kind for styling, for example "module", "file", "target", "external". */
  kind?: string;
  /** Forced column. When omitted the column comes from longest-path layering. */
  col?: number;
  size?: number;
  inCycle?: boolean;
}
export interface GEdge {
  from: string;
  to: string;
  weight?: number;
  cycle?: boolean;
  typeOnly?: boolean;
}
export interface PlacedNode extends GNode {
  x: number;
  y: number;
  w: number;
  h: number;
  col: number;
}
export interface PlacedEdge extends GEdge {
  d: string;
}
export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
  columns: number;
}

export const NODE_W = 196;
export const NODE_H = 46;
const COL_GAP = 96;
const ROW_GAP = 14;
const PAD = 28;

/** Longest-path layers after dropping the back edges found by a depth-first search. */
export function layerOf(ids: string[], edges: GEdge[]): Map<string, number> {
  const known = new Set(ids);
  const out = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges)
    if (known.has(e.from) && known.has(e.to) && e.from !== e.to) out.get(e.from)?.push(e.to);

  const state = new Map<string, 1 | 2>();
  const back = new Set<string>();
  for (const root of ids) {
    if (state.has(root)) continue;
    const stack: { v: string; i: number }[] = [{ v: root, i: 0 }];
    state.set(root, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1] as { v: string; i: number };
      const next = out.get(top.v) ?? [];
      if (top.i < next.length) {
        const w = next[top.i] as string;
        top.i++;
        const s = state.get(w);
        if (s === 1) back.add(`${top.v}\u0000${w}`);
        else if (s === undefined) {
          state.set(w, 1);
          stack.push({ v: w, i: 0 });
        }
      } else {
        state.set(top.v, 2);
        stack.pop();
      }
    }
  }

  const indeg = new Map<string, number>(ids.map((i) => [i, 0]));
  const fwd = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to) || e.from === e.to) continue;
    if (back.has(`${e.from}\u0000${e.to}`)) continue;
    fwd.get(e.from)?.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const layer = new Map<string, number>(ids.map((i) => [i, 0]));
  const queue = ids.filter((i) => (indeg.get(i) ?? 0) === 0);
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head] as string;
    for (const w of fwd.get(v) ?? []) {
      layer.set(w, Math.max(layer.get(w) ?? 0, (layer.get(v) ?? 0) + 1));
      const left = (indeg.get(w) ?? 1) - 1;
      indeg.set(w, left);
      if (left === 0) queue.push(w);
    }
  }
  return layer;
}

export function layoutGraph(nodes: GNode[], edges: GEdge[]): Layout {
  const ids = nodes.map((n) => n.id);
  const auto = layerOf(ids, edges);
  const colOf = (n: GNode): number => n.col ?? auto.get(n.id) ?? 0;

  const cols = new Map<number, GNode[]>();
  for (const n of nodes) {
    const c = colOf(n);
    const list = cols.get(c) ?? [];
    list.push(n);
    cols.set(c, list);
  }
  const colKeys = [...cols.keys()].sort((a, b) => a - b);
  const colIndex = new Map(colKeys.map((c, i) => [c, i]));

  const order = new Map<string, number>();
  for (const c of colKeys) {
    const list = cols.get(c) as GNode[];
    list.sort((a, b) => (b.size ?? 0) - (a.size ?? 0) || a.label.localeCompare(b.label));
    list.forEach((n, i) => {
      order.set(n.id, i);
    });
  }
  const nbrs = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) {
    nbrs.get(e.from)?.push(e.to);
    nbrs.get(e.to)?.push(e.from);
  }
  // Barycenter sweeps reduce edge crossings.
  for (let sweep = 0; sweep < 4; sweep++) {
    const sequence = sweep % 2 === 0 ? colKeys : [...colKeys].reverse();
    for (const c of sequence) {
      const list = cols.get(c) as GNode[];
      const bary = new Map<string, number>();
      for (const n of list) {
        const ns = nbrs.get(n.id) ?? [];
        bary.set(
          n.id,
          ns.length > 0
            ? ns.reduce((a, m) => a + (order.get(m) ?? 0), 0) / ns.length
            : (order.get(n.id) ?? 0),
        );
      }
      list.sort(
        (a, b) => (bary.get(a.id) ?? 0) - (bary.get(b.id) ?? 0) || a.label.localeCompare(b.label),
      );
      list.forEach((n, i) => {
        order.set(n.id, i);
      });
    }
  }

  const placed = new Map<string, PlacedNode>();
  let height = 0;
  for (const c of colKeys) {
    (cols.get(c) as GNode[]).forEach((n, i) => {
      const y = PAD + i * (NODE_H + ROW_GAP);
      placed.set(n.id, {
        ...n,
        col: c,
        x: PAD + (colIndex.get(c) ?? 0) * (NODE_W + COL_GAP),
        y,
        w: NODE_W,
        h: NODE_H,
      });
      height = Math.max(height, y + NODE_H + PAD);
    });
  }

  const placedEdges: PlacedEdge[] = [];
  for (const e of edges) {
    const a = placed.get(e.from);
    const b = placed.get(e.to);
    if (!a || !b || a === b) continue;
    const y1 = a.y + a.h / 2;
    const y2 = b.y + b.h / 2;
    let d: string;
    if (a.x < b.x) {
      const x1 = a.x + a.w;
      const x2 = b.x;
      const k = Math.max(40, (x2 - x1) / 2);
      d = `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
    } else {
      const x1 = a.x + a.w;
      const x2 = b.x + b.w;
      d = `M${x1},${y1} C${x1 + 72},${y1} ${x2 + 72},${y2} ${x2},${y2}`;
    }
    placedEdges.push({ ...e, d });
  }
  return {
    nodes: [...placed.values()],
    edges: placedEdges,
    width: PAD * 2 + colKeys.length * NODE_W + Math.max(0, colKeys.length - 1) * COL_GAP + 60,
    height: Math.max(height, 160),
    columns: colKeys.length,
  };
}
