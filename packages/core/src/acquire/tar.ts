import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { isSafeRelativePath } from "../util/paths.js";

export class ArchiveError extends Error {}

export interface ExtractLimits {
  maxCompressedBytes: number;
  maxExpandedBytes: number;
  maxFiles: number;
  maxFileBytes: number;
}

export interface ExtractResult {
  files: number;
  bytes: number;
  rootDir: string | null;
  skipped: { reason: string; count: number }[];
}

export const BLOCK = 512;

export function readString(buf: Buffer, start: number, len: number): string {
  const slice = buf.subarray(start, start + len);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? len : nul).toString("utf8");
}

export function readOctal(buf: Buffer, start: number, len: number): number {
  const s = readString(buf, start, len).trim();
  if (s === "") return 0;
  if (!/^[0-7]+$/.test(s)) throw new ArchiveError("Malformed numeric field in archive header");
  return Number.parseInt(s, 8);
}

export function parsePax(data: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let pos = 0;
  while (pos < data.length) {
    const space = data.indexOf(0x20, pos);
    if (space === -1) break;
    const len = Number.parseInt(data.subarray(pos, space).toString("utf8"), 10);
    if (!Number.isFinite(len) || len <= 0 || pos + len > data.length)
      throw new ArchiveError("Malformed pax header");
    const record = data.subarray(space + 1, pos + len - 1).toString("utf8");
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    pos += len;
  }
  return out;
}

/**
 * Safely extracts a gzip compressed tar into destDir.
 * Rejects traversal, absolute paths, links, devices, oversized and over-numerous entries.
 * Strips the single top-level directory that GitHub archives contain.
 */
export function extractTarGz(
  archive: Buffer,
  destDir: string,
  limits: ExtractLimits,
): ExtractResult {
  if (archive.length > limits.maxCompressedBytes)
    throw new ArchiveError("Archive exceeds the compressed size limit");
  let tar: Buffer;
  try {
    tar = gunzipSync(archive, { maxOutputLength: limits.maxExpandedBytes });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ERR_BUFFER_TOO_LARGE")
      throw new ArchiveError(
        "Archive exceeds the expanded size limit (possible decompression bomb)",
      );
    throw new ArchiveError("Archive is not a valid gzip stream");
  }

  const skipped = new Map<string, number>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  let files = 0;
  let bytes = 0;
  let rootDir: string | null = null;
  let pos = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  const seen = new Set<string>();

  while (pos + BLOCK <= tar.length) {
    const header = tar.subarray(pos, pos + BLOCK);
    if (header.every((b) => b === 0)) break;
    const name = readString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] ?? 0x30);
    const prefix = readString(header, 345, 155);
    const dataStart = pos + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new ArchiveError("Archive is truncated");
    const data = tar.subarray(dataStart, dataEnd);
    pos = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (type === "x") {
      paxPath = parsePax(data).path ?? null;
      continue;
    }
    if (type === "g") continue;
    if (type === "L") {
      longName = readString(data, 0, data.length);
      continue;
    }
    let fullName = paxPath ?? longName ?? (prefix ? `${prefix}/${name}` : name);
    paxPath = null;
    longName = null;

    if (type === "1" || type === "2") {
      skip(type === "2" ? "symbolic link rejected" : "hard link rejected");
      continue;
    }
    if (type !== "0" && type !== "\0" && type !== "5") {
      skip("special entry rejected");
      continue;
    }
    fullName = fullName.replace(/\/+$/, "");
    if (!isSafeRelativePath(fullName))
      throw new ArchiveError(`Unsafe path in archive: ${JSON.stringify(fullName.slice(0, 80))}`);
    const segments = fullName.split("/");
    const top = segments[0] as string;
    if (rootDir === null) rootDir = top;
    if (top !== rootDir) throw new ArchiveError("Archive has more than one top-level entry");
    const rel = segments.slice(1).join("/");
    if (type === "5" || rel === "") continue;
    if (seen.has(rel)) {
      skip("duplicate entry rejected");
      continue;
    }
    seen.add(rel);
    if (size > limits.maxFileBytes) {
      skip("file over per-file size limit");
      continue;
    }
    if (files + 1 > limits.maxFiles) throw new ArchiveError("Archive exceeds the file count limit");
    bytes += size;
    if (bytes > limits.maxExpandedBytes)
      throw new ArchiveError("Archive exceeds the expanded size limit");
    const target = join(destDir, ...rel.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data, { flag: "wx" });
    files += 1;
  }
  return {
    files,
    bytes,
    rootDir,
    skipped: [...skipped.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => a.reason.localeCompare(b.reason)),
  };
}

/** Test helper and fixture builder: creates a minimal ustar archive. Not used on untrusted input paths. */
export function buildTar(
  entries: { name: string; content?: string; type?: string; linkName?: string }[],
): Buffer {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const data = Buffer.from(e.content ?? "", "utf8");
    const header = Buffer.alloc(BLOCK);
    header.write(e.name.slice(0, 100), 0, "utf8");
    header.write("0000644\0", 100);
    header.write("0000000\0", 108);
    header.write("0000000\0", 116);
    header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
    header.write("00000000000\0", 136);
    header.write("        ", 148);
    header.write(e.type ?? "0", 156);
    if (e.linkName) header.write(e.linkName.slice(0, 100), 157);
    header.write("ustar\0", 257);
    header.write("00", 263);
    let sum = 0;
    for (const b of header) sum += b;
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    blocks.push(header, data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
  }
  blocks.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(blocks);
}
