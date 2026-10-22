import { jsTsAnalyzer } from "./js-ts.js";
import { pythonAnalyzer } from "./python.js";
import type { AnalyzerPlugin } from "./types.js";

/** Adding a language means adding a plugin here. The core pipeline does not change. */
export const DEFAULT_ANALYZERS: AnalyzerPlugin[] = [jsTsAnalyzer, pythonAnalyzer];

export function analyzerForLanguage(language: string, analyzers: AnalyzerPlugin[] = DEFAULT_ANALYZERS): AnalyzerPlugin | null {
  return analyzers.find((a) => a.languages.includes(language)) ?? null;
}
