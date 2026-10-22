import { sha256, stableStringify } from "../util/hash.js";

export type Curve = [number, number][];

export interface SubMetricDef {
  name: string;
  weight: number;
  /** Piecewise linear map from raw value to 0..100. Values outside the range are clamped. */
  curve: Curve;
  origin: "convention" | "provisional";
  description: string;
}

export interface ScoringProfile {
  name: string;
  version: string;
  minAvailableWeight: number;
  dimensions: Record<string, SubMetricDef[]>;
}

/** Thresholds are provisional conventions. They are documented in docs/product/scoring-methodology.md. */
export const DEFAULT_PROFILE: ScoringProfile = {
  name: "default",
  version: "1.0.0",
  minAvailableWeight: 0.5,
  dimensions: {
    architecture: [
      { name: "file-cycle-ratio", weight: 0.35, curve: [[0, 100], [0.02, 85], [0.1, 50], [0.3, 0]], origin: "provisional", description: "Share of source files that sit in a runtime import cycle" },
      { name: "module-cycle-ratio", weight: 0.15, curve: [[0, 100], [0.1, 70], [0.4, 0]], origin: "provisional", description: "Share of modules that sit in a module cycle" },
      { name: "rule-violations-per-100-edges", weight: 0.25, curve: [[0, 100], [1, 80], [5, 40], [15, 0]], origin: "provisional", description: "Architecture rule violations per 100 dependency edges (needs a rules file)" },
      { name: "unresolved-import-ratio", weight: 0.15, curve: [[0, 100], [0.02, 90], [0.1, 60], [0.3, 0]], origin: "provisional", description: "Internal imports that could not be resolved" },
      { name: "high-fan-out-share", weight: 0.1, curve: [[0, 100], [0.02, 80], [0.1, 30]], origin: "convention", description: "Share of files importing more than 20 files" },
    ],
    maintainability: [
      { name: "high-complexity-function-share", weight: 0.35, curve: [[0, 100], [0.02, 80], [0.1, 40], [0.25, 0]], origin: "convention", description: "Share of functions above the high complexity threshold" },
      { name: "duplication-ratio", weight: 0.3, curve: [[0, 100], [0.03, 85], [0.1, 50], [0.25, 0]], origin: "provisional", description: "Duplicated normalized lines divided by all normalized lines" },
      { name: "oversized-file-share", weight: 0.2, curve: [[0, 100], [0.05, 80], [0.2, 30]], origin: "convention", description: "Share of source files above 500 code lines" },
      { name: "hotspot-share", weight: 0.15, curve: [[0, 100], [0.02, 70], [0.1, 20]], origin: "provisional", description: "Share of files that are both frequently changed and complex (needs Git history)" },
    ],
    "security-hygiene": [
      { name: "vulnerable-dependency-weight", weight: 0.4, curve: [[0, 100], [2, 80], [10, 40], [30, 0]], origin: "provisional", description: "Known vulnerabilities weighted by severity (critical 10, high 5, medium 2, low 1)" },
      { name: "secret-findings", weight: 0.25, curve: [[0, 100], [1, 50], [3, 10], [5, 0]], origin: "provisional", description: "Possible committed secrets" },
      { name: "workflow-risk-weight", weight: 0.2, curve: [[0, 100], [2, 80], [8, 30], [15, 0]], origin: "provisional", description: "GitHub Actions risk findings weighted by severity" },
      { name: "lockfile-present", weight: 0.15, curve: [[0, 30], [1, 100]], origin: "convention", description: "A dependency lockfile exists" },
    ],
    "testing-ci": [
      { name: "test-to-source-file-ratio", weight: 0.35, curve: [[0, 0], [0.1, 50], [0.3, 90], [0.6, 100]], origin: "provisional", description: "Test files per source file. File presence is not test effectiveness" },
      { name: "ci-present", weight: 0.25, curve: [[0, 0], [1, 100]], origin: "convention", description: "A CI configuration exists" },
      { name: "lint-or-format", weight: 0.2, curve: [[0, 0], [1, 70], [2, 100]], origin: "convention", description: "Linter and formatter configuration present" },
      { name: "type-checking", weight: 0.2, curve: [[0, 0], [1, 100]], origin: "convention", description: "A type checker is configured" },
    ],
    documentation: [
      { name: "readme-completeness", weight: 0.35, curve: [[0, 0], [100, 100]], origin: "provisional", description: "README exists (50), has setup section (25), has usage section (25)" },
      { name: "community-files", weight: 0.25, curve: [[0, 0], [5, 100]], origin: "convention", description: "Count of license, contributing, code of conduct, security policy, changelog" },
      { name: "docs-and-decisions", weight: 0.2, curve: [[0, 0], [2, 100]], origin: "provisional", description: "A docs directory (1) and architecture decision records (1)" },
      { name: "setup-aids", weight: 0.2, curve: [[0, 30], [1, 70], [2, 100]], origin: "provisional", description: "Dockerfile, env example, Makefile, devcontainer" },
    ],
    "maintenance-activity": [
      { name: "author-concentration", weight: 0.5, curve: [[0.3, 100], [0.6, 70], [0.9, 30], [1, 10]], origin: "provisional", description: "Share of commits by the top author (continuity signal)" },
      { name: "commits-per-month", weight: 0.5, curve: [[0, 0], [1, 30], [4, 70], [10, 100]], origin: "provisional", description: "Commit density over the analyzed window (activity signal)" },
    ],
  },
};

export function profileHash(p: ScoringProfile): string {
  return sha256(stableStringify(p)).slice(0, 16);
}

export function applyCurve(curve: Curve, x: number): number {
  const first = curve[0] as [number, number];
  const last = curve[curve.length - 1] as [number, number];
  const ascending = first[0] <= last[0];
  const lo = ascending ? first[0] : last[0];
  const hi = ascending ? last[0] : first[0];
  if (x <= lo) return (ascending ? first : last)[1];
  if (x >= hi) return (ascending ? last : first)[1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i] as [number, number];
    const [x1, y1] = curve[i + 1] as [number, number];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}
