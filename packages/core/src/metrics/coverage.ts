import type { Workspace } from "../acquire/types.js";
import type { TestCoverageSummary } from "../ir/types.js";
import { basename } from "../util/paths.js";

export interface CoverageResult {
  summary: TestCoverageSummary;
  /** Line coverage 0..1 per repository file path. */
  perFile: Map<string, number>;
}

interface Parsed {
  format: NonNullable<TestCoverageSummary["format"]>;
  lineRate: number | null;
  files: { path: string; total: number; covered: number }[];
}

export function parseLcov(text: string): Parsed {
  const files: Parsed["files"] = [];
  let cur: {
    path: string;
    total: number;
    covered: number;
    da: number;
    hit: number;
    hasLf: boolean;
  } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:"))
      cur = { path: line.slice(3), total: 0, covered: 0, da: 0, hit: 0, hasLf: false };
    else if (!cur) continue;
    else if (line.startsWith("LF:")) {
      cur.total = Number(line.slice(3));
      cur.hasLf = true;
    } else if (line.startsWith("LH:")) cur.covered = Number(line.slice(3));
    else if (line.startsWith("DA:")) {
      const hits = Number(line.slice(3).split(",")[1]);
      cur.da++;
      if (hits > 0) cur.hit++;
    } else if (line === "end_of_record") {
      files.push({
        path: cur.path,
        total: cur.hasLf ? cur.total : cur.da,
        covered: cur.hasLf ? cur.covered : cur.hit,
      });
      cur = null;
    }
  }
  const total = files.reduce((s, f) => s + f.total, 0);
  const covered = files.reduce((s, f) => s + f.covered, 0);
  return { format: "lcov", lineRate: total > 0 ? covered / total : null, files };
}

export function parseIstanbulSummary(text: string): Parsed | null {
  let doc: Record<string, { lines?: { total?: number; covered?: number; pct?: number | string } }>;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || !doc.total) return null;
  const files: Parsed["files"] = [];
  for (const [path, v] of Object.entries(doc)) {
    if (
      path === "total" ||
      !v?.lines ||
      typeof v.lines.total !== "number" ||
      typeof v.lines.covered !== "number"
    )
      continue;
    files.push({ path, total: v.lines.total, covered: v.lines.covered });
  }
  const t = doc.total.lines;
  const rate =
    t && typeof t.total === "number" && t.total > 0 && typeof t.covered === "number"
      ? t.covered / t.total
      : null;
  return { format: "istanbul-summary", lineRate: rate, files };
}

export function parseCobertura(text: string): Parsed | null {
  if (!/<coverage\b/.test(text)) return null;
  const files: Parsed["files"] = [];
  for (const block of text.split(/<class\b/).slice(1)) {
    const head = /^[^>]*>/.exec(block)?.[0] ?? "";
    const filename = /filename="([^"]+)"/.exec(head)?.[1];
    if (!filename) continue;
    const body = block.split(/<\/class>/)[0] ?? "";
    const lines = body.match(/<line\b[^>]*>/g) ?? [];
    const covered = lines.filter((l) => Number(/hits="(\d+)"/.exec(l)?.[1] ?? 0) > 0).length;
    if (lines.length > 0) files.push({ path: filename, total: lines.length, covered });
  }
  const total = files.reduce((s, f) => s + f.total, 0);
  const covered = files.reduce((s, f) => s + f.covered, 0);
  const root = /<coverage\b[^>]*\bline-rate="([\d.]+)"/.exec(text)?.[1];
  return {
    format: "cobertura",
    lineRate: total > 0 ? covered / total : root ? Number(root) : null,
    files,
  };
}

const CANDIDATES = ["lcov.info", "coverage-summary.json", "cobertura-coverage.xml", "coverage.xml"];

function indexByBasename(paths: Iterable<string>): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const p of paths) {
    const b = basename(p);
    (m.get(b) ?? m.set(b, []).get(b))?.push(p);
  }
  return m;
}

/** Maps a path from a coverage report (absolute, or relative to some package) to a repository path. */
export function matchRepoPath(
  reported: string,
  repoPaths: Set<string>,
  byBase: Map<string, string[]>,
): string | null {
  const sf = reported.replace(/\\/g, "/").replace(/^\.\//, "");
  if (repoPaths.has(sf)) return sf;
  const candidates = byBase.get(basename(sf)) ?? [];
  const endsWithRepo = candidates
    .filter((p) => sf.endsWith(`/${p}`))
    .sort((a, b) => b.length - a.length);
  if (endsWithRepo.length > 0) return endsWithRepo[0] as string;
  const endsWithSf = candidates.filter((p) => p.endsWith(`/${sf}`));
  return endsWithSf.length === 1 ? (endsWithSf[0] as string) : null;
}

export function ingestCoverage(
  ws: Workspace,
  repoPaths: Set<string>,
  supplied?: { name: string; text: string } | null,
): CoverageResult {
  const none = (reason: string): CoverageResult => ({
    summary: {
      ingested: false,
      source: null,
      format: null,
      lineRate: null,
      filesMatched: null,
      reason,
    },
    perFile: new Map(),
  });
  let source: string | null = null;
  let text: string | null = null;
  if (supplied) {
    source = supplied.name;
    text = supplied.text;
  } else {
    for (const cand of CANDIDATES) {
      const hit = ws.files
        .filter((f) => basename(f.path) === cand)
        .sort((a, b) => a.path.length - b.path.length)[0];
      if (hit) {
        source = hit.path;
        text = ws.read(hit.path);
        break;
      }
    }
  }
  if (source === null || text === null)
    return none(
      "No coverage report found (lcov.info, coverage-summary.json or Cobertura XML). Supply one with --coverage or commit it as a CI artifact.",
    );
  const name = basename(source);
  const parsed: Parsed | null = name.endsWith(".json")
    ? parseIstanbulSummary(text)
    : name.endsWith(".xml")
      ? parseCobertura(text)
      : parseLcov(text);
  if (!parsed || parsed.lineRate === null)
    return none(`Coverage report ${source} could not be parsed or contains no line data`);
  const byBase = indexByBasename(repoPaths);
  const perFile = new Map<string, number>();
  for (const f of parsed.files) {
    const p = matchRepoPath(f.path, repoPaths, byBase);
    if (p && f.total > 0) perFile.set(p, f.covered / f.total);
  }
  return {
    summary: {
      ingested: true,
      source,
      format: parsed.format,
      lineRate: Math.round(parsed.lineRate * 10000) / 10000,
      filesMatched: perFile.size,
      reason: null,
    },
    perFile,
  };
}
