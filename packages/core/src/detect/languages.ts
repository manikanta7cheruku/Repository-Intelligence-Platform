import { extname } from "../util/paths.js";

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python", ".pyi": "python",
  ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin", ".kts": "kotlin",
  ".rb": "ruby", ".php": "php", ".cs": "csharp", ".swift": "swift", ".scala": "scala",
  ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".hpp": "cpp",
  ".sh": "shell", ".bash": "shell", ".ps1": "powershell",
  ".lua": "lua", ".dart": "dart", ".ex": "elixir", ".exs": "elixir", ".hs": "haskell",
  ".sql": "sql", ".vue": "vue", ".svelte": "svelte", ".r": "r", ".pl": "perl",
};

const DATA_EXT = new Set([
  ".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".cfg", ".env", ".lock", ".md", ".mdx", ".rst", ".txt",
  ".html", ".css", ".scss", ".sass", ".less", ".svg", ".csv", ".tsv", ".gql", ".graphql", ".proto",
]);

const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".pdf", ".zip", ".gz", ".tar", ".tgz", ".7z",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4", ".mov", ".wav", ".exe", ".dll", ".so", ".dylib",
  ".class", ".jar", ".pyc", ".wasm", ".bin", ".psd", ".sketch",
]);

/** Programming language of a path, or null when it is not a recognized programming language. */
export function languageOf(path: string): string | null {
  return EXT_LANG[extname(path)] ?? null;
}

export function isBinaryExt(path: string): boolean {
  return BINARY_EXT.has(extname(path));
}

export function isDataExt(path: string): boolean {
  return DATA_EXT.has(extname(path));
}

export const COMMENT_SYNTAX: Record<string, { line: string[]; block: [string, string][] }> = {
  typescript: { line: ["//"], block: [["/*", "*/"]] },
  javascript: { line: ["//"], block: [["/*", "*/"]] },
  python: { line: ["#"], block: [] },
  go: { line: ["//"], block: [["/*", "*/"]] },
  rust: { line: ["//"], block: [["/*", "*/"]] },
  java: { line: ["//"], block: [["/*", "*/"]] },
  kotlin: { line: ["//"], block: [["/*", "*/"]] },
  csharp: { line: ["//"], block: [["/*", "*/"]] },
  swift: { line: ["//"], block: [["/*", "*/"]] },
  scala: { line: ["//"], block: [["/*", "*/"]] },
  c: { line: ["//"], block: [["/*", "*/"]] },
  cpp: { line: ["//"], block: [["/*", "*/"]] },
  dart: { line: ["//"], block: [["/*", "*/"]] },
  php: { line: ["//", "#"], block: [["/*", "*/"]] },
  ruby: { line: ["#"], block: [] },
  shell: { line: ["#"], block: [] },
  powershell: { line: ["#"], block: [] },
  perl: { line: ["#"], block: [] },
  r: { line: ["#"], block: [] },
  elixir: { line: ["#"], block: [] },
  lua: { line: ["--"], block: [["--[[", "]]"]] },
  haskell: { line: ["--"], block: [["{-", "-}"]] },
  sql: { line: ["--"], block: [["/*", "*/"]] },
  vue: { line: ["//"], block: [["/*", "*/"]] },
  svelte: { line: ["//"], block: [["/*", "*/"]] },
};
