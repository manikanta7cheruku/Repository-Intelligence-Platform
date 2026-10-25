"use client";

import type { ScoreRecord, SubMetricInput } from "@repolens/core/browser";
import { dec, pct } from "@/lib/format";
import { chartCss, SCREEN_PALETTE } from "@/lib/svg";
import { useReport } from "./report-context";
import { Term } from "./ui";

const YES_NO = new Set(["lockfile-present", "ci-present", "type-checking"]);
const COUNT_OF: Record<string, number> = {
  "lint-or-format": 2,
  "community-files": 5,
  "setup-aids": 4,
};

/** The measured value in the unit people expect: a percentage for ratios, yes or no for presence checks. */
export function rawText(name: string, raw: number | null): string {
  if (raw === null) return "n/a";
  if (YES_NO.has(name)) return raw >= 1 ? "Yes" : "No";
  if (COUNT_OF[name]) return `${raw} of ${COUNT_OF[name]}`;
  if (/ratio$|share$/.test(name)) return pct(raw, raw < 0.1 ? 1 : 0);
  if (name === "readme-completeness") return `${Math.round(raw)} of 100`;
  if (name === "commits-per-month") return `${dec(raw, 1)} a month`;
  if (name === "docs-and-decisions") return `${raw} of 2`;
  return dec(raw, raw < 10 ? 2 : 1);
}

/** Anchor labels for the scale: the same unit as the measured value. */
const anchorText = (name: string, x: number): string => rawText(name, x);

const SCALE_W = 360;
const SCALE_H = 96;

/** A labeled picture of the rule: how a measured value turns into points, with this repository marked on it. */
function Scale({ input }: { input: SubMetricInput }) {
  const { curve, raw, name } = input;
  const xs = curve.map((c) => c[0]);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs, raw ?? Number.NEGATIVE_INFINITY);
  const span = hi - lo || 1;
  const l = 34;
  const r = 14;
  const t = 12;
  const b = 26;
  const px = (v: number) => l + ((v - lo) / span) * (SCALE_W - l - r);
  const py = (s: number) => SCALE_H - b - (s / 100) * (SCALE_H - t - b);
  const pts: [number, number][] = [...curve];
  const last = curve[curve.length - 1];
  if (last && hi > last[0]) pts.push([hi, last[1]]);
  const d = pts.map((c, i) => `${i === 0 ? "M" : "L"}${px(c[0])},${py(c[1])}`).join(" ");
  let at: number | null = null;
  if (raw !== null) {
    at = curve[curve.length - 1]?.[1] ?? 0;
    for (let i = 0; i < curve.length - 1; i++) {
      const a = curve[i] as [number, number];
      const c = curve[i + 1] as [number, number];
      if (raw >= a[0] && raw <= c[0]) {
        at = a[1] + ((raw - a[0]) / (c[0] - a[0] || 1)) * (c[1] - a[1]);
        break;
      }
    }
    if (raw < lo) at = curve[0]?.[1] ?? 0;
  }
  const label = `Scale for ${name}: ${curve.map(([x, y]) => `${anchorText(name, x)} gives ${y} points`).join(", ")}${raw !== null ? `. Measured ${rawText(name, raw)}.` : ""}`;
  // Anchor labels that would overlap are left out: the first and the last always show.
  const labelled = new Set<number>();
  let lastX = Number.NEGATIVE_INFINITY;
  curve.forEach(([x], i) => {
    if (px(x) - lastX >= 46 || i === 0) {
      labelled.add(i);
      lastX = px(x);
    }
  });
  const lastIdx = curve.length - 1;
  if (lastIdx > 0 && !labelled.has(lastIdx)) {
    const prev = [...labelled].pop();
    if (
      prev !== undefined &&
      prev !== 0 &&
      px(curve[lastIdx]?.[0] ?? 0) - px(curve[prev]?.[0] ?? 0) < 46
    )
      labelled.delete(prev);
    labelled.add(lastIdx);
  }
  const markerX = raw === null ? 0 : px(raw);
  const flip = raw !== null && markerX > SCALE_W - 90;
  return (
    <svg viewBox={`0 0 ${SCALE_W} ${SCALE_H}`} className="scale" role="img" aria-label={label}>
      <style>{chartCss(SCREEN_PALETTE)}</style>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line className="c-grid" x1={l} x2={SCALE_W - r} y1={py(g)} y2={py(g)} />
          <text className="c-text c-small c-muted" x={l - 6} y={py(g) + 3} textAnchor="end">
            {g}
          </text>
        </g>
      ))}
      <line className="c-axis" x1={l} x2={SCALE_W - r} y1={py(0)} y2={py(0)} />
      <path className="d-line" d={d} />
      {curve.map(([x, y], i) => (
        <g key={`${x}-${y}`}>
          <circle cx={px(x)} cy={py(y)} r={2.5} className="d-anchor" />
          {labelled.has(i) ? (
            <text
              className="c-text c-small c-muted"
              x={px(x)}
              y={SCALE_H - 10}
              textAnchor={i === 0 ? "start" : i === curve.length - 1 ? "end" : "middle"}
            >
              {anchorText(name, x)}
            </text>
          ) : null}
        </g>
      ))}
      {raw !== null && at !== null ? (
        <g>
          <line className="d-drop" x1={markerX} x2={markerX} y1={py(at)} y2={py(0)} />
          <circle className="d-marker" cx={markerX} cy={py(at)} r={4.5} />
          <text
            className="c-text c-small c-strong"
            x={flip ? markerX - 8 : markerX + 8}
            y={Math.max(t + 4, py(at) - 8)}
            textAnchor={flip ? "end" : "start"}
          >
            This repository: {rawText(name, raw)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function InputBlock({ input, maxShare }: { input: SubMetricInput; maxShare: number }) {
  const { select } = useReport();
  const earned = input.contribution ?? 0;
  const full = maxShare;
  const pctEarned = full === 0 ? 0 : Math.max(0, Math.min(100, (earned / full) * 100));
  const looksLikePath = (e: string) => /[\\/]/.test(e) || /\.[a-z]{1,5}$/i.test(e);
  return (
    <li className="pin">
      <div className="pin-head">
        <h4 className="pin-name">
          <Term id={input.name}>{input.name.replace(/-/g, " ")}</Term>
        </h4>
        <span className="pin-points num">
          {dec(earned, 1)} <span className="muted">of {dec(full, 1)} points</span>
        </span>
      </div>
      <p className="pin-desc">{input.description}</p>
      <div
        className="pin-bar"
        role="img"
        aria-label={`${dec(earned, 1)} of ${dec(full, 1)} points earned`}
      >
        <div className="pin-bar-fill" style={{ width: `${pctEarned}%` }} />
      </div>
      <dl className="pin-facts">
        <div>
          <dt>Measured</dt>
          <dd className="num">
            <b>{rawText(input.name, input.raw)}</b>
            <span className="muted"> {input.note}</span>
          </dd>
        </div>
        <div>
          <dt>Worth</dt>
          <dd className="num">
            {input.normalized === null ? "n/a" : Math.round(input.normalized)} of 100, weighted
            {" at "}
            {pct(input.weight)}
          </dd>
        </div>
        {input.impact !== null && input.impact > 0 ? (
          <div>
            <dt>Could gain</dt>
            <dd className="num">+{dec(input.impact, 1)} points</dd>
          </div>
        ) : null}
      </dl>
      <Scale input={input} />
      <p className="pin-origin small muted">
        {input.origin === "provisional"
          ? "Provisional scale: chosen by the tool author, not yet calibrated on real projects."
          : "Scale based on a common convention."}
      </p>
      {input.evidence.length > 0 ? (
        <div className="pin-evidence">
          <span className="small muted">Behind this number</span>
          <ul className="chips">
            {input.evidence.map((e) => (
              <li key={e}>
                {looksLikePath(e) ? (
                  <button
                    type="button"
                    className="path-link"
                    onClick={() => select({ kind: "file", path: e })}
                  >
                    {e}
                  </button>
                ) : (
                  <span className="small">{e}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function ProofPanel({ score, label }: { score: ScoreRecord; label: string }) {
  const used = score.inputs.filter((i) => i.available);
  const unused = score.inputs.filter((i) => !i.available);
  const availWeight = used.reduce((s, i) => s + i.weight, 0);
  const sorted = [...used].sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0));
  const best = [...used]
    .filter((i) => (i.impact ?? 0) > 0.05)
    .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))[0];
  return (
    <div className="proof" id={`proof-${score.dimension}`}>
      <div className="proof-top">
        <p className="proof-sentence">
          {score.state === "assessed" ? (
            <>
              <b>
                {label} is {score.value} out of 100.
              </b>{" "}
              It is the weighted average of {used.length}{" "}
              {used.length === 1 ? "measurement" : "measurements"}
              {unused.length > 0
                ? `, using ${pct(score.weightCoverage)} of the possible weight`
                : ""}
              . Each block below shows what was measured, how that value becomes points, and the
              files behind it.
            </>
          ) : (
            <>
              {label} could not be scored. {score.reason}
            </>
          )}
        </p>
        {best ? (
          <p className="proof-gain">
            <span className="small muted">Biggest opportunity</span>
            <b>
              {best.name.replace(/-/g, " ")}: up to +{dec(best.impact, 1)} points
            </b>
          </p>
        ) : null}
      </div>
      {used.length > 0 ? (
        <ol className="pins">
          {sorted.map((i) => (
            <InputBlock
              key={i.name}
              input={i}
              maxShare={availWeight === 0 ? 0 : (i.weight / availWeight) * 100}
            />
          ))}
        </ol>
      ) : null}
      {unused.length > 0 ? (
        <div className="pin-unused">
          <h4 className="h4">Not used, and not counted as zero</h4>
          <ul className="plain-list small">
            {unused.map((i) => (
              <li key={i.name}>
                <b>{i.name.replace(/-/g, " ")}</b>{" "}
                <span className="muted">
                  {i.note}. {i.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="proof-exact">
        <summary className="small">Exact derivation</summary>
        <p className="small">{score.basis}</p>
        <p className="small muted">
          Confidence {score.confidence ?? "n/a"} reflects how much of the code was analyzed (
          {pct(score.coverage)}), separate from the measurements above.
        </p>
      </details>
    </div>
  );
}
