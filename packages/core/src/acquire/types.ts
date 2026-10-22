import type { FileKind } from "../ir/types.js";

export interface WorkspaceFile {
  path: string;
  bytes: number;
  /** Absolute path on disk. */
  absPath: string;
}

export interface Workspace {
  root: string;
  files: WorkspaceFile[];
  /** Reads a file as UTF-8. Returns null for unreadable files. */
  read(path: string): string | null;
  has(path: string): boolean;
  excluded: { reason: string; count: number }[];
  truncated: boolean;
  limitations: string[];
}

export interface FileFilterResult {
  keep: boolean;
  kind?: FileKind;
  reason?: string;
}
