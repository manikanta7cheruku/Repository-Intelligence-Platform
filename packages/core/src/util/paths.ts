export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** True when a path from untrusted input stays inside its root. */
export function isSafeRelativePath(p: string): boolean {
  if (p.length === 0 || p.length > 1024) return false;
  if (p.includes("\0") || p.includes("\\")) return false;
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return false;
  return !p.split("/").some((seg) => seg === "..");
}

export function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

export function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i).toLowerCase();
}

export function joinPosix(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts.join("/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}
