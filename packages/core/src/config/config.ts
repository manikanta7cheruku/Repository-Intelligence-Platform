import { sha256, stableStringify } from "../util/hash.js";

export interface Budgets {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
  maxArchiveBytes: number;
  maxExpandedBytes: number;
  analysisTimeoutMs: number;
}

export interface AnalysisConfig {
  profile: string;
  budgets: Budgets;
  /** Extra exclude globs, applied on top of the built-in exclusions. */
  exclude: string[];
  includeTests: boolean;
  moduleDepth: number;
  complexity: { moderate: number; high: number; veryHigh: number };
  duplication: { enabled: boolean; minLines: number; minChars: number; includeTests: boolean };
  history: {
    enabled: boolean;
    maxCommits: number;
    authors: "names" | "anonymous";
    hotspotLimit: number;
  };
  security: {
    offline: boolean;
    osv: boolean;
    secrets: boolean;
    workflows: boolean;
    gitleaksPath: string | null;
  };
  rulesFile: string | null;
  baselineFile: string | null;
}

export const DEFAULT_CONFIG: AnalysisConfig = {
  profile: "default",
  budgets: {
    maxFiles: 20_000,
    maxTotalBytes: 200 * 1024 * 1024,
    maxFileBytes: 5 * 1024 * 1024,
    maxArchiveBytes: 60 * 1024 * 1024,
    maxExpandedBytes: 250 * 1024 * 1024,
    analysisTimeoutMs: 120_000,
  },
  exclude: [],
  includeTests: true,
  moduleDepth: 1,
  complexity: { moderate: 10, high: 20, veryHigh: 50 },
  duplication: { enabled: true, minLines: 8, minChars: 120, includeTests: false },
  history: { enabled: true, maxCommits: 5000, authors: "names", hotspotLimit: 15 },
  security: { offline: false, osv: true, secrets: true, workflows: true, gitleaksPath: null },
  rulesFile: null,
  baselineFile: null,
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function merge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override))
    return (override === undefined ? base : override) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (!(k in base)) throw new ConfigError(`Unknown configuration key: ${k}`);
    if (v === undefined) continue;
    out[k] = merge((base as Record<string, unknown>)[k], v);
  }
  return out as T;
}

export class ConfigError extends Error {}

/** Layered configuration: defaults, then each override in order (later wins). Unknown keys are errors. */
export function resolveConfig(...layers: DeepPartial<AnalysisConfig>[]): AnalysisConfig {
  let config: AnalysisConfig = DEFAULT_CONFIG;
  for (const layer of layers) config = merge(config, layer);
  validateConfig(config);
  return config;
}

export function validateConfig(c: AnalysisConfig): void {
  const positive = (name: string, v: number) => {
    if (!Number.isFinite(v) || v <= 0) throw new ConfigError(`${name} must be a positive number`);
  };
  for (const [k, v] of Object.entries(c.budgets)) positive(`budgets.${k}`, v);
  positive("moduleDepth", c.moduleDepth);
  positive("history.maxCommits", c.history.maxCommits);
  positive("duplication.minLines", c.duplication.minLines);
  if (!(c.complexity.moderate < c.complexity.high && c.complexity.high < c.complexity.veryHigh)) {
    throw new ConfigError("complexity thresholds must increase: moderate < high < veryHigh");
  }
  if (!["names", "anonymous"].includes(c.history.authors))
    throw new ConfigError("history.authors must be names or anonymous");
}

export function configHash(c: AnalysisConfig): string {
  return sha256(stableStringify(c)).slice(0, 16);
}
