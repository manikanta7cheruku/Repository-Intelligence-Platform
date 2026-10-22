import { createHash } from "node:crypto";

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function shortHash(input: string, length = 12): string {
  return sha256(input).slice(0, length);
}

export const fileIdFor = (path: string): string => `f_${shortHash(path)}`;
export const moduleIdFor = (path: string): string => `m_${shortHash(`module:${path}`)}`;

/** JSON.stringify with sorted object keys, used for content hashes and determinism checks. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
