/**
 * Parser for the YAML subset used by RepoLens rule and config files.
 * Supported: nested maps, block lists ("- item", "- key: value"), inline lists ["a", "b"], scalars
 * (strings, numbers, booleans, null), comments. Not supported (rejected with an error): anchors, tags,
 * multi-line block scalars, multiple documents, flow maps.
 */
export class YamlSubsetError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`YAML line ${line}: ${message}`);
  }
}

interface Line {
  indent: number;
  text: string;
  no: number;
}

function stripComment(s: string): string {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === "#" && (i === 0 || /\s/.test(s[i - 1] as string))) return s.slice(0, i);
  }
  return s;
}

function parseScalar(raw: string, no: number): unknown {
  const s = raw.trim();
  if (s === "") return null;
  if (s.startsWith("[")) {
    if (!s.endsWith("]")) throw new YamlSubsetError("unterminated inline list", no);
    const inner = s.slice(1, -1).trim();
    if (inner === "") return [];
    const items: string[] = [];
    let cur = "";
    let q: string | null = null;
    for (const c of inner) {
      if (q) {
        cur += c;
        if (c === q) q = null;
      } else if (c === '"' || c === "'") {
        q = c;
        cur += c;
      } else if (c === ",") {
        items.push(cur);
        cur = "";
      } else cur += c;
    }
    items.push(cur);
    return items.map((i) => parseScalar(i, no));
  }
  if (s.startsWith("{")) throw new YamlSubsetError("flow maps are not supported", no);
  if (/^[&*!|>]/.test(s))
    throw new YamlSubsetError("anchors, tags and block scalars are not supported", no);
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

export function parseYamlSubset(text: string): unknown {
  const lines: Line[] = [];
  text.split(/\r\n|\r|\n/).forEach((raw, i) => {
    if (raw.includes("\t") && /^\s*\t/.test(raw))
      throw new YamlSubsetError("tabs are not allowed for indentation", i + 1);
    const noComment = stripComment(raw).replace(/\s+$/, "");
    if (noComment.trim() === "" || noComment.trim() === "---") return;
    lines.push({
      indent: noComment.length - noComment.trimStart().length,
      text: noComment.trim(),
      no: i + 1,
    });
  });
  if (lines.length === 0) return {};
  let pos = 0;

  const parseBlock = (indent: number): unknown => {
    const first = lines[pos] as Line;
    if (first.text.startsWith("- ") || first.text === "-") return parseList(indent);
    return parseMap(indent);
  };

  const splitKey = (text: string, no: number): [string, string] => {
    const m = /^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*)|$)/.exec(text);
    if (!m) throw new YamlSubsetError(`expected "key: value", got "${text}"`, no);
    let key = m[1] as string;
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))
      key = key.slice(1, -1);
    return [key, m[2] ?? ""];
  };

  const parseMap = (indent: number): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    while (pos < lines.length) {
      const l = lines[pos] as Line;
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlSubsetError("unexpected indentation", l.no);
      if (l.text.startsWith("- ")) break;
      const [key, rest] = splitKey(l.text, l.no);
      if (key in out) throw new YamlSubsetError(`duplicate key "${key}"`, l.no);
      pos++;
      if (rest !== "") out[key] = parseScalar(rest, l.no);
      else {
        const next = lines[pos];
        if (
          next &&
          (next.indent > indent || (next.indent === indent && next.text.startsWith("- ")))
        )
          out[key] = parseBlock(next.indent);
        else out[key] = null;
      }
    }
    return out;
  };

  const parseList = (indent: number): unknown[] => {
    const out: unknown[] = [];
    while (pos < lines.length) {
      const l = lines[pos] as Line;
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlSubsetError("unexpected indentation", l.no);
      if (!(l.text.startsWith("- ") || l.text === "-")) break;
      const rest = l.text === "-" ? "" : l.text.slice(2).trim();
      if (rest === "") {
        pos++;
        const next = lines[pos];
        out.push(next && next.indent > indent ? parseBlock(next.indent) : null);
      } else if (/^("[^"]*"|'[^']*'|[^:\s][^:]*?)\s*:(\s|$)/.test(rest) && !rest.startsWith("[")) {
        // "- key: value" starts an inline map item. Re-point the line at the item content.
        const childIndent = indent + 2;
        lines[pos] = { indent: childIndent, text: rest, no: l.no };
        out.push(parseMap(childIndent));
      } else {
        pos++;
        out.push(parseScalar(rest, l.no));
      }
    }
    return out;
  };

  const result = parseBlock((lines[0] as Line).indent);
  if (pos < lines.length) throw new YamlSubsetError("unexpected content", (lines[pos] as Line).no);
  return result;
}
