import { COMMENT_SYNTAX } from "../detect/languages.js";

export interface LineCounts {
  lines: number;
  code: number;
  comment: number;
  blank: number;
  /** False when the language has no comment syntax table, so comments count as code. */
  commentAware: boolean;
}

const BACKTICK_LANGS = new Set(["javascript", "typescript", "go", "vue", "svelte"]);
const TRIPLE_QUOTE_LANGS = new Set(["python", "java", "kotlin", "scala", "swift", "csharp"]);

/** String and comment aware line classification. Docstrings and string literals count as code. */
export function countLines(text: string, language: string | null): LineCounts {
  const syntax = language ? COMMENT_SYNTAX[language] : undefined;
  const raw = text.split(/\r\n|\r|\n/);
  if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();
  let code = 0;
  let comment = 0;
  let blank = 0;
  if (!syntax) {
    for (const l of raw) l.trim() === "" ? blank++ : code++;
    return { lines: raw.length, code, comment, blank, commentAware: false };
  }
  const backtick = language !== null && BACKTICK_LANGS.has(language);
  const triple = language !== null && TRIPLE_QUOTE_LANGS.has(language);
  let blockEnd: string | null = null;
  let stringCloser: string | null = null;

  for (const line of raw) {
    if (line.trim() === "") {
      blank++;
      continue;
    }
    let hasCode = false;
    let hasComment = false;
    let i = 0;
    while (i < line.length) {
      if (blockEnd !== null) {
        hasComment = true;
        const idx = line.indexOf(blockEnd, i);
        if (idx === -1) {
          i = line.length;
        } else {
          i = idx + blockEnd.length;
          blockEnd = null;
        }
        continue;
      }
      if (stringCloser !== null) {
        hasCode = true;
        const closer = stringCloser;
        let j = i;
        let closed = false;
        while (j < line.length) {
          if (line[j] === "\\" && closer.length === 1) {
            j += 2;
            continue;
          }
          if (line.startsWith(closer, j)) {
            j += closer.length;
            closed = true;
            break;
          }
          j++;
        }
        i = Math.min(j, line.length);
        if (closed) stringCloser = null;
        continue;
      }
      const c = line[i] as string;
      if (c === " " || c === "\t") {
        i++;
        continue;
      }
      const lineMarker = syntax.line.find((m) => line.startsWith(m, i));
      if (lineMarker) {
        hasComment = true;
        break;
      }
      const block = syntax.block.find(([start]) => line.startsWith(start, i));
      if (block) {
        hasComment = true;
        blockEnd = block[1];
        i += block[0].length;
        continue;
      }
      if (triple && (line.startsWith('"""', i) || line.startsWith("'''", i))) {
        hasCode = true;
        stringCloser = line.slice(i, i + 3);
        i += 3;
        continue;
      }
      if (c === '"' || c === "'" || (backtick && c === "`")) {
        hasCode = true;
        let j = i + 1;
        let closed = false;
        while (j < line.length) {
          if (line[j] === "\\") {
            j += 2;
            continue;
          }
          if (line[j] === c) {
            closed = true;
            j++;
            break;
          }
          j++;
        }
        i = Math.min(j, line.length);
        if (!closed && c === "`") stringCloser = "`";
        continue;
      }
      hasCode = true;
      i++;
    }
    if (hasCode) code++;
    else if (hasComment) comment++;
    else blank++;
  }
  return { lines: raw.length, code, comment, blank, commentAware: true };
}
