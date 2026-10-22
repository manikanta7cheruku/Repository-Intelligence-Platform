import type { Workspace } from "../acquire/types.js";
import type { AnalysisConfig } from "../config/config.js";
// biome-ignore lint/suspicious/noShadowRestrictedNames: Symbol is the domain model type.
import type { Dependency, FunctionMetric, SupportLevel, Symbol } from "../ir/types.js";

export interface EligibleFile {
  path: string;
  language: string;
  id: string;
}

export interface AnalyzerContext {
  ws: Workspace;
  config: AnalysisConfig;
  /** Every file in the repository (all languages), for resolution. */
  allPaths: Set<string>;
  files: EligibleFile[];
  signal: AbortSignal;
}

export interface FileAnalysis {
  path: string;
  dependencies: Dependency[];
  symbols: Omit<Symbol, "fileId">[];
  functions: Omit<FunctionMetric, "fileId" | "path">[];
  dynamicUnresolved: number;
  parseError: string | null;
}

export interface AnalyzerResult {
  files: FileAnalysis[];
  limitations: string[];
}

export type Capability = "imports" | "exports" | "symbols" | "complexity" | "resolution";

export interface AnalyzerPlugin {
  id: string;
  version: string;
  languages: string[];
  supportLevel: SupportLevel;
  capabilities: Capability[];
  limitations: string[];
  analyze(ctx: AnalyzerContext): Promise<AnalyzerResult>;
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("Analysis aborted");
}
