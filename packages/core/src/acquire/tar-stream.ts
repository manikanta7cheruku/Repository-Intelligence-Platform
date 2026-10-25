import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { isBinaryExt } from "../util/binary.js";
import { isSafeRelativePath } from "../util/paths.js";
import { ALWAYS_EXCLUDED_DIRS } from "./local.js";
import { ArchiveError, BLOCK, type ExtractResult, parsePax, readOctal, readString } from "./tar.js";

export interface StreamLimits {
  /** Compressed bytes read from the network. */
  maxDownloadBytes: number;
  /** Uncompressed bytes passed through the parser (decompression bomb guard). Skipped data counts too. */
  maxScanBytes: number;
  /** Bytes of files that are kept for analysis. */
  maxKeptBytes: number;
  maxFiles: number;
  maxFileBytes: number;
}

export interface StreamResult extends ExtractResult {
  /** True when files were left out only because a budget ran out. */
  truncated: boolean;
  scannedBytes: number;
  downloadedBytes: number;
  skippedBytes: number;
  /** Files left out of the unpacked tree that still belong to the repository. Capped at 100,000 entries. */
  skippedFiles: { path: string; bytes: number; reason: string }[];
}

type Mode = "keep" | "skip" | "meta-pax" | "meta-long" | "meta-ignore";

/**
 * Streams a gzip compressed tar into destDir without holding the archive in memory.
 * Only analyzable files are written: dependency folders, binary and media files, oversized files and anything past the
 * file or byte budget are skipped, counted and reported. Unsafe paths, links, devices and more than one top-level
 * directory are rejected. The download size itself is capped, not the amount of skipped data.
 */
export async function extractTarGzStream(
  source: AsyncIterable<Uint8Array>,
  destDir: string,
  limits: StreamLimits,
  signal?: AbortSignal,
): Promise<StreamResult> {
  let downloaded = 0;
  const counted = (async function* () {
    for await (const chunk of source) {
      downloaded += chunk.length;
      if (downloaded > limits.maxDownloadBytes)
        throw new ArchiveError(
          `Repository download is larger than the budget of ${Math.round(limits.maxDownloadBytes / 1048576)} MB`,
        );
      yield chunk;
    }
  })();
  const gunzip = createGunzip();
  const input = Readable.from(counted);
  input.on("error", (e) => gunzip.destroy(e));
  input.pipe(gunzip);

  const skipped = new Map<string, number>();
  const skip = (reason: string, bytes: number) => {
    skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
    skippedBytes += bytes;
  };
  let skippedBytes = 0;
  const skippedFiles: { path: string; bytes: number; reason: string }[] = [];
  const noteSkipped = (path: string, bytes: number, reason: string) => {
    if (skippedFiles.length < 100_000) skippedFiles.push({ path, bytes, reason });
  };
  let files = 0;
  let keptBytes = 0;
  let scanned = 0;
  let truncated = false;
  let rootDir: string | null = null;
  const seen = new Set<string>();

  let pending: Buffer = Buffer.alloc(0);
  let state: "header" | "data" | "pad" | "end" = "header";
  let mode: Mode = "skip";
  let remaining = 0;
  let padLeft = 0;
  let chunks: Buffer[] = [];
  let entryRel = "";
  let paxPath: string | null = null;
  let longName: string | null = null;

  const finishEntry = () => {
    const data = Buffer.concat(chunks);
    chunks = [];
    if (mode === "meta-pax") paxPath = parsePax(data).path ?? null;
    else if (mode === "meta-long") longName = readString(data, 0, data.length);
    else if (mode === "keep") {
      const target = join(destDir, ...entryRel.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data, { flag: "wx" });
      files += 1;
      keptBytes += data.length;
    }
  };

  const readHeader = (header: Buffer): boolean => {
    if (header.every((b) => b === 0)) {
      state = "end";
      return false;
    }
    const name = readString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] ?? 0x30);
    const prefix = readString(header, 345, 155);
    padLeft = (BLOCK - (size % BLOCK)) % BLOCK;
    remaining = size;
    chunks = [];
    if (type === "x" || type === "g" || type === "L") {
      if (size > 65_536) throw new ArchiveError("Archive metadata entry is too large");
      mode = type === "x" ? "meta-pax" : type === "L" ? "meta-long" : "meta-ignore";
      return true;
    }
    let fullName = paxPath ?? longName ?? (prefix ? `${prefix}/${name}` : name);
    paxPath = null;
    longName = null;
    mode = "skip";
    if (type === "1" || type === "2") {
      skip(type === "2" ? "symbolic link rejected" : "hard link rejected", size);
      return true;
    }
    if (type !== "0" && type !== "\0" && type !== "5") {
      skip("special entry rejected", size);
      return true;
    }
    fullName = fullName.replace(/\/+$/, "");
    if (!isSafeRelativePath(fullName))
      throw new ArchiveError(`Unsafe path in archive: ${JSON.stringify(fullName.slice(0, 80))}`);
    const segments = fullName.split("/");
    const top = segments[0] as string;
    if (rootDir === null) rootDir = top;
    if (top !== rootDir) throw new ArchiveError("Archive has more than one top-level entry");
    const rel = segments.slice(1).join("/");
    if (type === "5" || rel === "") return true;
    if (seen.has(rel)) {
      skip("duplicate entry rejected", size);
      return true;
    }
    seen.add(rel);
    const excluded = segments.slice(1, -1).find((s) => ALWAYS_EXCLUDED_DIRS[s] !== undefined);
    if (excluded !== undefined) {
      skip(`inside ${excluded} (${ALWAYS_EXCLUDED_DIRS[excluded]})`, size);
      return true;
    }
    if (isBinaryExt(rel)) {
      skip("binary or media file (not analyzed)", size);
      noteSkipped(rel, size, "binary or media file");
      return true;
    }
    if (size > limits.maxFileBytes) {
      skip("file over the per-file size limit", size);
      noteSkipped(rel, size, "file exceeds the per-file size budget");
      return true;
    }
    if (files >= limits.maxFiles) {
      truncated = true;
      skip("file count budget reached", size);
      noteSkipped(rel, size, "not analyzed: file count budget reached");
      return true;
    }
    if (keptBytes + size > limits.maxKeptBytes) {
      truncated = true;
      skip("analysis size budget reached", size);
      noteSkipped(rel, size, "not analyzed: size budget reached");
      return true;
    }
    entryRel = rel;
    mode = "keep";
    return true;
  };

  const drain = () => {
    for (;;) {
      if (state === "end") {
        pending = Buffer.alloc(0);
        return;
      }
      if (state === "header") {
        if (pending.length < BLOCK) return;
        const header = pending.subarray(0, BLOCK);
        pending = pending.subarray(BLOCK);
        if (!readHeader(header)) continue;
        state = remaining > 0 ? "data" : "pad";
        if (remaining === 0) finishEntry();
        continue;
      }
      if (state === "data") {
        const take = Math.min(remaining, pending.length);
        if (take === 0) return;
        if (mode !== "skip") chunks.push(pending.subarray(0, take));
        pending = pending.subarray(take);
        remaining -= take;
        scanned += take;
        if (scanned > limits.maxScanBytes)
          throw new ArchiveError("Repository is too large to scan (possible decompression bomb)");
        if (remaining === 0) {
          finishEntry();
          state = "pad";
        }
        continue;
      }
      const take = Math.min(padLeft, pending.length);
      pending = pending.subarray(take);
      padLeft -= take;
      if (padLeft > 0) return;
      state = "header";
    }
  };

  try {
    for await (const chunk of gunzip) {
      signal?.throwIfAborted();
      pending = pending.length > 0 ? Buffer.concat([pending, chunk as Buffer]) : (chunk as Buffer);
      drain();
    }
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    if (signal?.aborted) throw e;
    const code = (e as { code?: string }).code ?? "";
    if (code.startsWith("Z_") || code === "ERR_STREAM_PREMATURE_CLOSE")
      throw new ArchiveError("Archive is not a valid or complete gzip stream");
    throw e;
  }
  const endState = state as string;
  if (endState === "data" || (endState === "header" && pending.length > 0))
    throw new ArchiveError("Archive is truncated");

  return {
    files,
    bytes: keptBytes,
    rootDir,
    skipped: [...skipped.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => a.reason.localeCompare(b.reason)),
    truncated,
    scannedBytes: scanned,
    downloadedBytes: downloaded,
    skippedBytes,
    skippedFiles,
  };
}
