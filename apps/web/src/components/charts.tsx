"use client";

import type { Report } from "@repolens/core/browser";
import { type RefObject, useCallback } from "react";
import { dateText, num, tail } from "@/lib/format";
import { buildExportSvg, chartCss, EXPORT_PALETTE, fileStem, SCREEN_PALETTE } from "@/lib/svg";
import type { ExportSource } from "./export-menu";

/** Serializes a rendered chart (its inner markup) into the shared light export document. */
export function useChartExport(
  ref: RefObject<SVGSVGElement | null>,
  report: Report,
  view: string,
  title: string,
  w: number,
  h: number,
  legend: string[] = [],
  data?: () => unknown,
): ExportSource {
  const svg = useCallback(() => {
    const node = ref.current;
    const inner = node ? node.innerHTML.replace(/<style[\s\S]*?<\/style>/g, "") : "";
    return buildExportSvg(inner, w, h, {
      title,
      repo: report.repository.name,
      commit: report.repository.commitSha,
      date: dateText(report.reproducibility.finishedAt),
      tool: `RepoLens ${report.reproducibility.toolVersion}`,
      legend,
    });
  }, [ref, report, title, w, h, legend]);
  return data
    ? { stem: fileStem(report.repository.name, view), title, svg, data }
    : { stem: fileStem(report.repository.name, view), title, svg };
}

const LEVELS = [
  { key: "low", label: "Low", range: "up to the moderate limit" },
  { key: "moderate", label: "Moderate", range: "above moderate" },
  { key: "high", label: "High", range: "above high" },
  { key: "veryHigh", label: "Very high", range: "above very high" },
] as const;

export function ComplexityBar({
  dist,
  svgRef,
}: {
  dist: NonNullable<Report["metrics"]["complexityDistribution"]>;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const total = dist.low + dist.moderate + dist.high + dist.veryHigh;
  const W = 640;
  let x = 0;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} 74`}
      className="chart"
      role="img"
      aria-label={`Functions by complexity: ${LEVELS.map((l) => `${l.label} ${dist[l.key]}`).join(", ")}`}
    >
      <style>{chartCss(SCREEN_PALETTE)}</style>
      {LEVELS.map((l) => {
        const w = total === 0 ? 0 : (dist[l.key] / total) * W;
        const seg = (
          <g key={l.key}>
            <rect className={`d-seg-${l.key}`} x={x} y={0} width={Math.max(w, 0)} height={22} />
            <text className="c-text c-small c-strong" x={x} y={42}>
              {l.label}
            </text>
            <text className="c-text c-small c-muted" x={x} y={58}>
              {num(dist[l.key])} functions
            </text>
          </g>
        );
        x += w;
        return seg;
      })}
    </svg>
  );
}

export function LanguageBar({
  languages,
  svgRef,
}: {
  languages: Report["scope"]["languages"];
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const rows = languages.filter((l) => l.codeLines > 0).sort((a, b) => b.codeLines - a.codeLines);
  const total = rows.reduce((s, l) => s + l.codeLines, 0);
  const W = 640;
  const shades = ["#0A0A0B", "#3F3F46", "#71717A", "#A1A1AA", "#D4D4D8"];
  let x = 0;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${34 + rows.length * 20}`}
      className="chart"
      role="img"
      aria-label={`Code lines by language: ${rows.map((l) => `${l.language} ${l.codeLines}`).join(", ")}`}
    >
      <style>{chartCss(SCREEN_PALETTE)}</style>
      {rows.map((l, i) => {
        const w = total === 0 ? 0 : (l.codeLines / total) * W;
        const el = (
          <rect key={l.language} x={x} y={0} width={w} height={14} fill={shades[Math.min(i, 4)]} />
        );
        x += w;
        return el;
      })}
      {rows.map((l, i) => (
        <g key={l.language} transform={`translate(0,${32 + i * 20})`}>
          <rect width={10} height={10} y={-9} fill={shades[Math.min(i, 4)]} />
          <text className="c-text c-small" x={18}>
            {l.language}
          </text>
          <text className="c-text c-small c-muted" x={150}>
            {num(l.codeLines)} lines, support level {l.supportLevel}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function HotspotScatter({
  points,
  svgRef,
  onOpen,
}: {
  points: { path: string; commits: number; complexity: number; churn: number; hot: boolean }[];
  svgRef: RefObject<SVGSVGElement | null>;
  onOpen: (path: string) => void;
}) {
  const W = 640;
  const H = 320;
  const m = { l: 48, r: 16, t: 12, b: 40 };
  const maxX = Math.max(1, ...points.map((p) => p.commits));
  const maxY = Math.max(1, ...points.map((p) => p.complexity));
  const maxC = Math.max(1, ...points.map((p) => p.churn));
  const sx = (v: number) => m.l + (v / maxX) * (W - m.l - m.r);
  const sy = (v: number) => H - m.b - (v / maxY) * (H - m.t - m.b);
  const ticks = (max: number) => Array.from(new Set([0, Math.round(max / 2), max]));
  const labeled: typeof points = [];
  for (const p of [...points].sort((a, b) => b.complexity * b.commits - a.complexity * a.commits)) {
    const clash = labeled.some(
      (q) =>
        Math.abs(sx(q.commits) - sx(p.commits)) < 70 &&
        Math.abs(sy(q.complexity) - sy(p.complexity)) < 14,
    );
    if (!clash && labeled.length < 4) labeled.push(p);
  }
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      role="group"
      aria-label="Hotspots: complexity against number of commits"
    >
      <style>{chartCss(SCREEN_PALETTE)}</style>
      {ticks(maxY).map((t) => (
        <g key={`y${t}`}>
          <line className="c-grid" x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} />
          <text className="c-text c-small c-muted" x={m.l - 8} y={sy(t) + 3} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {ticks(maxX).map((t) => (
        <text
          key={`x${t}`}
          className="c-text c-small c-muted"
          x={sx(t)}
          y={H - m.b + 16}
          textAnchor="middle"
        >
          {t}
        </text>
      ))}
      <line className="c-axis" x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} />
      <line className="c-axis" x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} />
      <text className="c-text c-small c-muted" x={(W + m.l) / 2} y={H - 6} textAnchor="middle">
        Commits touching the file
      </text>
      <text
        className="c-text c-small c-muted"
        transform={`translate(12,${(H - m.b + m.t) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        Highest function complexity
      </text>
      {points.map((p) => (
        <circle
          key={p.path}
          className={`d-dot${p.hot ? " hot" : ""} g-pt`}
          cx={sx(p.commits)}
          cy={sy(p.complexity)}
          r={4 + (p.churn / maxC) * 8}
          role="button"
          tabIndex={0}
          aria-label={`${p.path}: ${p.commits} commits, complexity ${p.complexity}, churn ${p.churn}`}
          onClick={() => onOpen(p.path)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(p.path);
            }
          }}
        >
          <title>{`${p.path}\n${p.commits} commits, complexity ${p.complexity}, churn ${p.churn}`}</title>
        </circle>
      ))}
      {labeled.map((p) => (
        <text
          key={`l${p.path}`}
          className="c-text c-small"
          x={sx(p.commits) + 10}
          y={sy(p.complexity) + 3}
        >
          {tail(p.path, 1)}
        </text>
      ))}
    </svg>
  );
}

/** Shows how a raw value maps to a score on the input's curve, with the raw value marked. */
export function CurveSpark({
  curve,
  raw,
  label,
}: {
  curve: [number, number][];
  raw: number | null;
  label: string;
}) {
  const W = 132;
  const H = 40;
  const xs = curve.map((c) => c[0]);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs, raw ?? -Infinity);
  const span = hi - lo || 1;
  const px = (v: number) => 4 + ((v - lo) / span) * (W - 8);
  const py = (s: number) => H - 4 - (s / 100) * (H - 8);
  const pts = [...curve, [hi, curve[curve.length - 1]?.[1] ?? 0] as [number, number]];
  const d = pts.map((c, i) => `${i === 0 ? "M" : "L"}${px(c[0])},${py(c[1])}`).join(" ");
  let my: number | null = null;
  if (raw !== null) {
    for (let i = 0; i < curve.length - 1; i++) {
      const a = curve[i] as [number, number];
      const b = curve[i + 1] as [number, number];
      if (raw >= a[0] && raw <= b[0]) {
        my = a[1] + ((raw - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1]);
        break;
      }
    }
    if (my === null) my = raw < lo ? (curve[0]?.[1] ?? 0) : (curve[curve.length - 1]?.[1] ?? 0);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" role="img" aria-label={label}>
      <style>{chartCss(SCREEN_PALETTE)}</style>
      <line className="c-grid" x1={4} x2={W - 4} y1={py(50)} y2={py(50)} />
      <path className="d-line" d={d} />
      {raw !== null && my !== null ? (
        <circle className="d-marker" cx={px(raw)} cy={py(my)} r={4} />
      ) : null}
    </svg>
  );
}

export const exportPalette = EXPORT_PALETTE;
