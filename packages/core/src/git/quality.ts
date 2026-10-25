import type { CommitQuality } from "../ir/types.js";

const CONVENTIONAL =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?:\s+\S/i;
const GENERIC =
  /^(fix(es|ed)?|update[sd]?|wip|changes?|misc|stuff|temp|tmp|test(ing)?|commit|initial commit|minor|small changes?|\.+|asdf+|done|save)\.?$/i;
const MERGE = /^(Merge (branch|pull request|remote-tracking|tag)|Revert ")/;

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** Signals about commit message habits. Merge commits are excluded. Never a statement about code quality. */
export function commitQuality(subjects: string[]): CommitQuality | null {
  const sample = subjects.map((s) => s.trim()).filter((s) => s !== "" && !MERGE.test(s));
  if (sample.length === 0) return null;
  const conventional = sample.filter((s) => CONVENTIONAL.test(s)).length;
  const generic = sample.filter((s) => GENERIC.test(s)).length;
  const descriptive = sample.filter((s) => s.length >= 15 && !GENERIC.test(s)).length;
  return {
    sampled: sample.length,
    conventionalShare: round(conventional / sample.length),
    descriptiveShare: round(descriptive / sample.length),
    genericShare: round(generic / sample.length),
    avgSubjectLength:
      Math.round((sample.reduce((s, x) => s + x.length, 0) / sample.length) * 10) / 10,
  };
}
