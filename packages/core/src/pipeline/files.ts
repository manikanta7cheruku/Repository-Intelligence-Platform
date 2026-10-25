import type { Workspace } from "../acquire/types.js";
import type { AnalysisConfig } from "../config/config.js";
import { classifyPath, looksGenerated } from "../detect/classify.js";
import type { FileRecord } from "../ir/types.js";
import { countLines } from "../metrics/loc.js";
import { fileIdFor } from "../util/hash.js";

/** Step 1 of the pipeline: classify every file, count lines, and keep the text of source and test files. */
export function classifyFiles(
  ws: Workspace,
  config: AnalysisConfig,
): { files: FileRecord[]; texts: Map<string, string> } {
  const files: FileRecord[] = [];
  const texts = new Map<string, string>();
  for (const f of ws.files) {
    const c = classifyPath(f.path);
    let { kind, reason } = c;
    const language = c.language;
    let lines: number | null = null;
    let codeLines: number | null = null;
    let notAnalyzedReason: string | null = null;
    if (kind === "other" && language === null) {
      const text = ws.read(f.path);
      if (text?.slice(0, 8000).includes("\0")) {
        kind = "binary";
        reason = "contains NUL bytes";
      }
    }
    if (
      language !== null &&
      (kind === "source" || kind === "test" || kind === "generated" || kind === "vendored")
    ) {
      const text = ws.read(f.path);
      if (text === null) {
        notAnalyzedReason =
          f.bytes > config.budgets.maxFileBytes
            ? "file exceeds the per-file size budget"
            : "file could not be read";
      } else {
        if (kind === "source" && looksGenerated(text)) {
          kind = "generated";
          reason = "generated code marker in file header";
        }
        const counts = countLines(text, language);
        lines = counts.lines;
        codeLines = counts.code;
        if (kind === "source" || kind === "test") texts.set(f.path, text);
      }
    }
    if (kind === "test" && !config.includeTests)
      notAnalyzedReason = "tests excluded by configuration";
    files.push({
      id: fileIdFor(f.path),
      path: f.path,
      language,
      kind,
      kindReason: reason,
      bytes: f.bytes,
      lines,
      codeLines,
      analyzed: false,
      notAnalyzedReason,
    });
  }
  // Files that were not unpacked still belong to the repository: count them and say why they were not analyzed.
  for (const sk of ws.skipped ?? []) {
    const c = classifyPath(sk.path);
    files.push({
      id: fileIdFor(sk.path),
      path: sk.path,
      language: c.language,
      kind: c.kind,
      kindReason: c.reason,
      bytes: sk.bytes,
      lines: null,
      codeLines: null,
      analyzed: false,
      notAnalyzedReason: c.kind === "binary" ? null : sk.reason,
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, texts };
}
