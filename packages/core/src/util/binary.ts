import { extname } from "./paths.js";

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".wav",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".jar",
  ".pyc",
  ".wasm",
  ".bin",
  ".psd",
  ".sketch",
]);

export function isBinaryExt(path: string): boolean {
  return BINARY_EXT.has(extname(path));
}
