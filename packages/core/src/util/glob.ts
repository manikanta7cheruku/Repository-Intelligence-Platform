const SPECIAL = /[.+^$()|[\]\\]/g;
const escapeRe = (s: string): string => s.replace(SPECIAL, "\\$&");

/**
 * Compile a glob to a RegExp over POSIX style repo-relative paths.
 * Supported: `**`, `*`, `?`, `{a,b}`. A pattern without `/` matches the basename at any depth.
 */
export function globToRegExp(glob: string): RegExp {
  const g = glob.replace(/^\.\//, "");
  let re = "";
  let i = 0;
  while (i < g.length) {
    const c = g[i] as string;
    if (c === "*") {
      if (g[i + 1] === "*") {
        const atSegmentStart = i === 0 || g[i - 1] === "/";
        if (atSegmentStart && g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
          continue;
        }
        re += ".*";
        i += 2;
        continue;
      }
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    if (c === "{") {
      const end = g.indexOf("}", i);
      if (end > i) {
        const alts = g
          .slice(i + 1, end)
          .split(",")
          .map(escapeRe);
        re += `(?:${alts.join("|")})`;
        i = end + 1;
        continue;
      }
    }
    re += escapeRe(c);
    i += 1;
  }
  const anchored = g.includes("/") ? `^${re}$` : `^(?:.*/)?${re}$`;
  return new RegExp(anchored);
}

export class GlobSet {
  private readonly regexes: RegExp[];
  constructor(globs: readonly string[]) {
    this.regexes = globs.map(globToRegExp);
  }
  matches(path: string): boolean {
    return this.regexes.some((r) => r.test(path));
  }
  get size(): number {
    return this.regexes.length;
  }
}
