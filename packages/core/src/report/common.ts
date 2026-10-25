import { DIMENSION_LABELS, explain } from "../glossary/glossary.js";
import type { Report, ScoreRecord } from "../ir/types.js";

export const dimLabel = (d: string): string => DIMENSION_LABELS[d] ?? d;
export const inputLabel = (name: string): string => explain(name)?.label ?? name;

export interface Improvement {
  dimension: string;
  input: string;
  label: string;
  currentScore: number | null;
  gain: number;
  advice: string;
  note: string;
}

/** Inputs ranked by how many points the dimension could gain, with the advice from the glossary. */
export function improvements(r: Report, perDimension = 3): Improvement[] {
  const out: Improvement[] = [];
  for (const s of r.scores) {
    if (s.state !== "assessed") continue;
    const list = s.inputs
      .filter((i) => i.available && (i.impact ?? 0) >= 1)
      .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0) || a.name.localeCompare(b.name))
      .slice(0, perDimension);
    for (const i of list)
      out.push({
        dimension: s.dimension,
        input: i.name,
        label: inputLabel(i.name),
        currentScore: i.normalized,
        gain: i.impact ?? 0,
        advice: explain(i.name)?.improve ?? "",
        note: i.note,
      });
  }
  return out;
}

export const missingInputs = (s: ScoreRecord): string[] =>
  s.inputs.filter((i) => !i.available).map((i) => `${inputLabel(i.name)} (${i.note})`);

export const GLOSSARY_IDS_ALWAYS = [
  "confidence",
  "coverage",
  "weight-coverage",
  "not-assessed",
  "support-level",
  "severity",
  "origin",
  "classification",
  "module",
  "fan-in",
  "fan-out",
  "instability",
  "cycle",
  "risk-index",
  "blast-radius",
  "hotspot",
  "baseline",
];

export function glossaryIdsFor(r: Report): string[] {
  const ids = new Set<string>(GLOSSARY_IDS_ALWAYS);
  for (const s of r.scores) {
    ids.add(s.dimension);
    for (const i of s.inputs) ids.add(i.name);
  }
  if (r.history.commitQuality) ids.add("commit-quality");
  if (r.history.pullRequests) ids.add("pull-request-signals");
  return [...ids];
}

export const pctText = (v: number | null): string =>
  v === null ? "n/a" : `${Math.round(v * 1000) / 10}%`;
