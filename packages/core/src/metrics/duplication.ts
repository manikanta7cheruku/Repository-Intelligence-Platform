import type { AnalysisConfig } from "../config/config.js";
import type { Metrics } from "../ir/types.js";

export interface DupInputFile {
  path: string;
  text: string;
  language: string | null;
}

interface Norm {
  text: string;
  line: number;
}

/** Normalizes code lines: drops blank, comment-only and punctuation-only lines, collapses whitespace. */
function normalize(text: string, language: string | null): Norm[] {
  const lineComment = language === "python" || language === "ruby" || language === "shell" ? "#" : "//";
  const out: Norm[] = [];
  let inBlock = false;
  text.split(/\r\n|\r|\n/).forEach((raw, i) => {
    let l = raw.trim();
    if (inBlock) {
      if (l.includes("*/")) inBlock = false;
      return;
    }
    if (lineComment === "//" && l.startsWith("/*")) {
      if (!l.includes("*/")) inBlock = true;
      return;
    }
    if (l === "" || l.startsWith(lineComment)) return;
    l = l.replace(/\s+/g, " ");
    if (/^[{}()[\];,]*$/.test(l)) return;
    out.push({ text: l, line: i + 1 });
  });
  return out;
}

/**
 * Window-hash clone detection over normalized lines. A clone is at least `minLines` consecutive
 * normalized lines with at least `minChars` characters that appear in two or more places.
 */
export function detectDuplication(files: DupInputFile[], config: AnalysisConfig): Metrics["duplication"] {
  const { minLines, minChars } = config.duplication;
  const norm = files.map((f) => ({ path: f.path, lines: normalize(f.text, f.language) }));
  const totalLines = norm.reduce((s, f) => s + f.lines.length, 0);
  if (totalLines === 0) {
    return { assessed: false, reason: "No analyzable source lines", duplicatedLines: null, totalLines: null, ratio: null, groups: [] };
  }
  const buckets = new Map<string, { f: number; start: number }[]>();
  norm.forEach((f, fi) => {
    for (let s = 0; s + minLines <= f.lines.length; s++) {
      let chars = 0;
      let key = "";
      for (let k = 0; k < minLines; k++) {
        const t = (f.lines[s + k] as Norm).text;
        chars += t.length;
        key += `${t}\n`;
      }
      if (chars < minChars) continue;
      const list = buckets.get(key) ?? [];
      list.push({ f: fi, start: s });
      buckets.set(key, list);
    }
  });

  const dupMark = norm.map((f) => new Uint8Array(f.lines.length));
  const groupMap = new Map<string, { lines: number; occ: { f: number; start: number; end: number }[] }>();
  for (const [key, occs] of buckets) {
    if (occs.length < 2) continue;
    for (const o of occs) for (let k = 0; k < minLines; k++) (dupMark[o.f] as Uint8Array)[o.start + k] = 1;
    const gk = key;
    if (!groupMap.has(gk)) groupMap.set(gk, { lines: minLines, occ: occs.map((o) => ({ ...o, end: o.start + minLines - 1 })) });
  }
  const duplicated = dupMark.reduce((s, m) => s + m.reduce((a, b) => a + b, 0), 0);

  // Merge overlapping windows into maximal clone regions per group of identical starting file and offsets.
  const merged: { lines: number; occurrences: { path: string; startLine: number; endLine: number }[] }[] = [];
  const claimed = new Set<string>();
  const sortedGroups = [...groupMap.values()].sort((a, b) => {
    const ak = `${norm[(a.occ[0] as { f: number }).f]?.path}:${(a.occ[0] as { start: number }).start}`;
    const bk = `${norm[(b.occ[0] as { f: number }).f]?.path}:${(b.occ[0] as { start: number }).start}`;
    return ak.localeCompare(bk);
  });
  for (const g of sortedGroups) {
    const first = g.occ[0] as { f: number; start: number; end: number };
    const sig = `${first.f}:${first.start}`;
    if (claimed.has(sig)) continue;
    // Extend each occurrence forward while all occurrences keep matching.
    let extra = 0;
    for (;;) {
      const texts = g.occ.map((o) => norm[o.f]?.lines[o.end + 1 + extra]?.text);
      if (texts.some((t) => t === undefined) || texts.some((t) => t !== texts[0])) break;
      extra++;
    }
    for (const o of g.occ) for (let k = 0; k <= extra; k++) claimed.add(`${o.f}:${o.start + k}`);
    merged.push({
      lines: minLines + extra,
      occurrences: g.occ.map((o) => {
        const f = norm[o.f] as { path: string; lines: Norm[] };
        return { path: f.path, startLine: (f.lines[o.start] as Norm).line, endLine: (f.lines[o.end + extra] as Norm).line };
      }),
    });
  }
  merged.sort((a, b) => b.lines * b.occurrences.length - a.lines * a.occurrences.length || (a.occurrences[0]?.path ?? "").localeCompare(b.occurrences[0]?.path ?? ""));
  return {
    assessed: true,
    reason: null,
    duplicatedLines: duplicated,
    totalLines,
    ratio: Math.round((duplicated / totalLines) * 10000) / 10000,
    groups: merged.slice(0, 20),
  };
}
