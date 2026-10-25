"use client";

import { select } from "d3-selection";
import { type D3ZoomEvent, type ZoomBehavior, zoom, zoomIdentity } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type GEdge, type GNode, type Layout, layoutGraph, type PlacedNode } from "@/lib/layout";
import { buildExportSvg, chartCss, type ExportMeta, SCREEN_PALETTE } from "@/lib/svg";

const MAX_LABEL = 25;
const cut = (s: string, n = MAX_LABEL): string =>
  s.length <= n ? s : `...${s.slice(s.length - n + 3)}`;
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Role = "none" | "self" | "in" | "out";

/** Edges around one node: who depends on it (in) and what it depends on (out). */
function neighborhood(edges: GEdge[], id: string | null) {
  const inN = new Set<string>();
  const outN = new Set<string>();
  if (id)
    for (const e of edges) {
      if (e.to === id) inN.add(e.from);
      if (e.from === id) outN.add(e.to);
    }
  return { inN, outN };
}

/** Markup for the static export. Same classes as the screen, so charts look alike everywhere. */
export function graphExportInner(layout: Layout, focus: string | null, edges: GEdge[]): string {
  const { inN, outN } = neighborhood(edges, focus);
  const lines = layout.edges
    .map((e) => {
      const cls = ["e-line", e.cycle ? "is-cycle" : "", e.typeOnly ? "type-only" : ""];
      if (focus) {
        if (e.to === focus) cls.push("s-in");
        else if (e.from === focus) cls.push("s-out");
        else cls.push("dim");
      }
      return `<path class="${cls.filter(Boolean).join(" ")}" d="${e.d}"/>`;
    })
    .join("");
  const boxes = layout.nodes
    .map((n) => {
      const dim = focus && n.id !== focus && !inN.has(n.id) && !outN.has(n.id) ? " dim" : "";
      const kind = n.kind ? ` kind-${n.kind}` : "";
      return `<g class="${dim.trim()}"><rect class="n-box${kind}${n.inCycle ? " is-cycle" : ""}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6"/><text class="n-label${kind}" x="${n.x + 10}" y="${n.y + 19}">${esc(cut(n.label))}</text>${n.sub ? `<text class="n-sub${kind}" x="${n.x + 10}" y="${n.y + 35}">${esc(n.sub)}</text>` : ""}</g>`;
    })
    .join("");
  return `<g>${lines}${boxes}</g>`;
}

export function graphExportSvg(
  nodes: GNode[],
  edges: GEdge[],
  focus: string | null,
  meta: ExportMeta,
): string {
  const layout = layoutGraph(nodes, edges);
  return buildExportSvg(graphExportInner(layout, focus, edges), layout.width, layout.height, meta);
}

export interface LayeredGraphProps {
  nodes: GNode[];
  edges: GEdge[];
  label: string;
  onOpen?: (id: string) => void;
  selectedId?: string | null;
  query?: string;
  height?: number;
  emptyText?: string;
}

export function LayeredGraph({
  nodes,
  edges,
  label,
  onOpen,
  selectedId = null,
  query = "",
  height = 560,
  emptyText = "Nothing to draw.",
}: LayeredGraphProps) {
  const layout = useMemo(() => layoutGraph(nodes, edges), [nodes, edges]);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [k, setK] = useState(1);
  const focus = hover ?? selectedId;
  const { inN, outN } = useMemo(() => neighborhood(edges, focus), [edges, focus]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      new Set(
        q ? layout.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id) : [],
      ),
    [layout, q],
  );

  /** all=true shows the whole graph. Otherwise labels stay readable and the user pans. */
  const fit = useCallback(
    (all = false) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      if (!svg || !z) return;
      const w = svg.clientWidth || 800;
      const h = svg.clientHeight || height;
      const whole = Math.min(1, w / layout.width, h / layout.height);
      const s = all ? Math.max(0.1, whole) : Math.max(0.72, whole);
      const tx = s === whole ? Math.max(0, (w - layout.width * s) / 2) : 8;
      select(svg).call(z.transform, zoomIdentity.translate(tx, 8).scale(s));
    },
    [layout, height],
  );

  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on("zoom", (ev: D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.setAttribute("transform", ev.transform.toString());
        setK(ev.transform.k);
      });
    zoomRef.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
    fit(false);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, [fit]);

  const by = useZoomBy(svgRef, zoomRef);

  const roleOf = (id: string): Role =>
    id === focus ? "self" : inN.has(id) ? "in" : outN.has(id) ? "out" : "none";

  const onKey = (ev: React.KeyboardEvent, n: PlacedNode) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onOpen?.(n.id);
      return;
    }
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[ev.key as "ArrowRight" | "ArrowLeft"];
    const vert = { ArrowDown: 1, ArrowUp: -1 }[ev.key as "ArrowDown" | "ArrowUp"];
    if (!dir && !vert) return;
    ev.preventDefault();
    const pool = layout.nodes.filter((m) =>
      dir
        ? dir > 0
          ? m.x > n.x
          : m.x < n.x
        : vert && vert > 0
          ? m.x === n.x && m.y > n.y
          : m.x === n.x && m.y < n.y,
    );
    pool.sort(
      (a, b) =>
        Math.abs(a.x - n.x) - Math.abs(b.x - n.x) || Math.abs(a.y - n.y) - Math.abs(b.y - n.y),
    );
    const next = pool[0];
    if (next) document.getElementById(`gn-${next.id}`)?.focus();
  };

  if (nodes.length === 0) return <div className="graph-empty">{emptyText}</div>;
  const showSub = k > 0.55;

  return (
    <div className="graph" style={{ height }}>
      <svg
        ref={svgRef}
        className="graph-svg"
        role="group"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        <style>{chartCss(SCREEN_PALETTE)}</style>
        <g ref={gRef}>
          {layout.edges.map((e) => {
            const cls = ["e-line"];
            if (e.cycle) cls.push("is-cycle");
            if (e.typeOnly) cls.push("type-only");
            if (focus) {
              if (e.to === focus) cls.push("s-in");
              else if (e.from === focus) cls.push("s-out");
              else cls.push("dim");
            } else if (q) cls.push("dim");
            return <path key={`${e.from}>${e.to}`} className={cls.join(" ")} d={e.d} />;
          })}
          {layout.nodes.map((n) => {
            const role = roleOf(n.id);
            const dimmed =
              (focus !== null && role === "none") || (q !== "" && !matches.has(n.id) && !focus);
            const kind = n.kind ? ` kind-${n.kind}` : "";
            return (
              <g
                key={n.id}
                id={`gn-${n.id}`}
                className={`g-node${dimmed ? " dim" : ""}${selectedId === n.id ? " is-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ""}${n.inCycle ? ", in a cycle" : ""}`}
                onMouseEnter={() => setHover(n.id)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                onClick={() => onOpen?.(n.id)}
                onKeyDown={(ev) => onKey(ev, n)}
              >
                <title>{n.label}</title>
                <rect
                  className={`n-box${kind}${n.inCycle ? " is-cycle" : ""}${q && matches.has(n.id) ? " is-match" : ""}`}
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={6}
                />
                <text className={`n-label${kind}`} x={n.x + 10} y={n.y + 19}>
                  {cut(n.label)}
                </text>
                {n.sub && showSub ? (
                  <text className={`n-sub${kind}`} x={n.x + 10} y={n.y + 35}>
                    {n.sub}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="graph-tools" role="group" aria-label="Zoom controls">
        <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => by(1.4)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Zoom out"
          onClick={() => by(1 / 1.4)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Show everything"
          title="Show everything"
          onClick={() => fit(true)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function useZoomBy(
  svgRef: React.RefObject<SVGSVGElement | null>,
  zoomRef: React.RefObject<ZoomBehavior<SVGSVGElement, unknown> | null>,
) {
  return useCallback(
    (factor: number) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      if (svg && z) select(svg).call(z.scaleBy, factor);
    },
    [svgRef, zoomRef],
  );
}

export function GraphLegend({
  items,
}: {
  items: { swatch: "in" | "out" | "cycle" | "type" | "target" | "box"; text: string }[];
}) {
  return (
    <ul className="legend" aria-label="Legend">
      {items.map((i) => (
        <li key={i.text}>
          <span className={`sw sw-${i.swatch}`} aria-hidden="true" />
          {i.text}
        </li>
      ))}
    </ul>
  );
}
