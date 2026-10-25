import type { Confidence, Severity } from "@repolens/core/browser";

export const nf = new Intl.NumberFormat("en-US");
export const num = (n: number | null | undefined): string =>
  n === null || n === undefined ? "n/a" : nf.format(n);
export const pct = (v: number | null | undefined, digits = 0): string =>
  v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(digits)}%`;
export const dec = (v: number | null | undefined, digits = 2): string =>
  v === null || v === undefined ? "n/a" : v.toFixed(digits);
export const shortSha = (s: string | null): string => (s ? s.slice(0, 7) : "n/a");
export const dateText = (iso: string | null | undefined): string => {
  if (!iso) return "n/a";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "n/a"
    : d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
};
export const isoDay = (iso: string): string => iso.slice(0, 10);

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};
export const confidenceLabel = (c: Confidence | null): string =>
  c === null ? "n/a" : c.charAt(0).toUpperCase() + c.slice(1);

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Last two path segments, for compact labels. */
export const tail = (path: string, n = 2): string => path.split("/").slice(-n).join("/");
