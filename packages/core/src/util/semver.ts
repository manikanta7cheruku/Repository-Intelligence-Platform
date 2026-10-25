/** Minimal version comparison for advisory data. Handles dotted numeric versions with optional pre-release suffixes. */
export interface ParsedVersion {
  parts: number[];
  pre: boolean;
}

export function parseVersion(v: string): ParsedVersion | null {
  const m = /^v?(\d+(?:\.\d+)*)(.*)$/.exec(v.trim());
  if (!m) return null;
  const rest = (m[2] as string).trim();
  return { parts: (m[1] as string).split(".").map(Number), pre: /^[-+]?(alpha|beta|rc|dev|pre|a\d|b\d)/i.test(rest) || /^-/.test(rest) };
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a.localeCompare(b);
  const n = Math.max(pa.parts.length, pb.parts.length);
  for (let i = 0; i < n; i++) {
    const d = (pa.parts[i] ?? 0) - (pb.parts[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (pa.pre !== pb.pre) return pa.pre ? -1 : 1;
  return 0;
}

export type UpdateJump = "patch" | "minor" | "major";

export interface FixChoice {
  version: string;
  jump: UpdateJump;
}

/** Picks the smallest fixed version above the installed one, preferring one within the same major version. */
export function nearestFix(installed: string, fixed: string[]): FixChoice | null {
  const inst = parseVersion(installed);
  if (!inst) return null;
  const higher = [...new Set(fixed)]
    .filter((f) => parseVersion(f) && compareVersions(f, installed) > 0)
    .sort(compareVersions);
  if (higher.length === 0) return null;
  const sameMajor = higher.find((f) => (parseVersion(f) as ParsedVersion).parts[0] === inst.parts[0]);
  const pick = sameMajor ?? (higher[0] as string);
  const p = parseVersion(pick) as ParsedVersion;
  const jump: UpdateJump = p.parts[0] !== inst.parts[0] ? "major" : (p.parts[1] ?? 0) !== (inst.parts[1] ?? 0) ? "minor" : "patch";
  return { version: pick, jump };
}
