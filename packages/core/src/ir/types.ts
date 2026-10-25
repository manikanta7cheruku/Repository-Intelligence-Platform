/**
 * Intermediate representation and report model (schema 0.1.0).
 * Rule: a value that was not computed is `null` with a reason, never 0.
 */
export const REPORT_SCHEMA_VERSION = "0.2.0";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
export type Origin = "observed" | "inferred" | "documented";
export type FileKind =
  | "source"
  | "test"
  | "config"
  | "docs"
  | "generated"
  | "vendored"
  | "binary"
  | "other";
export type SupportLevel = 1 | 2 | 3 | 4 | 5;
export type ReportStatus = "complete" | "partial" | "failed";
export type SecurityClass = "confirmed" | "probable" | "heuristic" | "needs-manual-review";
export type FindingCategory =
  | "architecture"
  | "quality"
  | "security"
  | "practices"
  | "documentation"
  | "history"
  | "analysis";

export interface FileRecord {
  id: string;
  path: string;
  language: string | null;
  kind: FileKind;
  kindReason: string;
  bytes: number;
  lines: number | null;
  codeLines: number | null;
  analyzed: boolean;
  notAnalyzedReason: string | null;
}

export type DependencyKind = "import" | "require" | "dynamic" | "type-only" | "reexport";
export type Resolution = "resolved" | "external" | "unresolved" | "ignored";

export interface Dependency {
  fromPath: string;
  specifier: string;
  kind: DependencyKind;
  line: number;
  resolution: Resolution;
  toPath: string | null;
  externalPackage: string | null;
  builtin: boolean;
  reason: string | null;
}

export interface Symbol {
  fileId: string;
  name: string;
  kind: "function" | "class" | "interface" | "type" | "enum" | "variable" | "namespace";
  exported: boolean;
  line: number;
  endLine: number;
}

export interface FunctionMetric {
  fileId: string;
  path: string;
  name: string;
  line: number;
  endLine: number;
  complexity: number;
  approximate: boolean;
}

export interface FileMetrics {
  fileId: string;
  path: string;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  functions: number;
  maxComplexity: number | null;
  totalComplexity: number | null;
}

export interface Location {
  path: string;
  startLine: number | null;
  endLine: number | null;
}

export interface Evidence {
  kind: "location" | "graph-path" | "tool-output" | "doc-reference" | "metric";
  refs: string[];
  note: string | null;
}

export interface Finding {
  id: string;
  title: string;
  category: FindingCategory;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  origin: Origin;
  classification: SecurityClass | null;
  explanation: string;
  evidence: Evidence[];
  locations: Location[];
  remediation: string;
  limitations: string[];
  tags: string[];
}

export interface CoverageRecord {
  analyzerId: string;
  language: string;
  supportLevel: SupportLevel;
  filesEligible: number;
  filesAnalyzed: number;
  ratio: number | null;
  limitations: string[];
}

export interface ModuleRecord {
  id: string;
  path: string;
  kind: "directory" | "package";
  fileCount: number;
  loc: number;
  fanIn: number | null;
  fanOut: number | null;
  instability: number | null;
  origin: Origin;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  typeOnly: boolean;
  occurrences: { line: number; specifier: string; kind: DependencyKind }[];
}

export interface CycleRecord {
  scope: "file" | "module";
  members: string[];
  size: number;
  /** True when the cycle disappears once type-only imports are ignored. */
  typeOnly: boolean;
}

export interface GraphModel {
  nodes: { id: string; path: string; moduleId: string; fanIn: number; fanOut: number }[];
  edges: GraphEdge[];
  modules: ModuleRecord[];
  moduleEdges: { from: string; to: string; weight: number }[];
  cycles: CycleRecord[];
  levels: { moduleId: string; level: number; origin: Origin; confidence: Confidence }[];
  entrypointReachable: {
    analyzable: boolean;
    reachableFiles: number | null;
    unreachableFiles: number | null;
  };
  resolution: {
    internalImports: number;
    resolved: number;
    unresolved: number;
    external: number;
    ratio: number | null;
  };
}

export interface ExternalDependencyRecord {
  name: string;
  builtin: boolean;
  importingFiles: number;
  importCount: number;
}

export interface SubMetricInput {
  name: string;
  /** Maximum points this dimension could gain if this input reached 100. Null when unavailable. */
  impact: number | null;
  raw: number | null;
  normalized: number | null;
  weight: number;
  available: boolean;
  note: string;
}

export interface ScoreRecord {
  dimension:
    | "architecture"
    | "maintainability"
    | "security-hygiene"
    | "testing-ci"
    | "documentation"
    | "maintenance-activity";
  state: "assessed" | "not-assessed";
  value: number | null;
  confidence: Confidence | null;
  coverage: number | null;
  /** Share of the dimension weight that had data (0 to 1). */
  weightCoverage: number | null;
  reason: string | null;
  inputs: SubMetricInput[];
}

export interface Recommendation {
  rank: number;
  title: string;
  rationale: string;
  priority: number;
  findingIds: string[];
  effort: "low" | "medium" | "high" | null;
}

export interface DetectionSummary {
  packageManagers: string[];
  manifests: string[];
  lockfiles: string[];
  frameworks: { name: string; evidence: string }[];
  entrypoints: { path: string; reason: string }[];
  buildTools: string[];
  runtimes: string[];
  license: { file: string | null; spdxGuess: string | null };
}

export interface PracticesSummary {
  ci: { providers: string[]; workflowFiles: string[] };
  tests: {
    frameworks: string[];
    testFiles: number;
    sourceFiles: number;
    testToSourceFileRatio: number | null;
    coverageReport: "ingested" | "not-ingested";
  };
  quality: {
    linters: string[];
    formatters: string[];
    typeCheckers: string[];
    strictTypeScript: boolean | null;
  };
  documentation: {
    readme: {
      path: string | null;
      words: number | null;
      headings: string[];
      hasInstall: boolean | null;
      hasUsage: boolean | null;
      /** Detected section kinds: overview, install, usage, contributing, license, testing, architecture, status. */
      sections: string[];
      links: number;
    };
    files: {
      contributing: boolean;
      codeOfConduct: boolean;
      security: boolean;
      changelog: boolean;
      license: boolean;
    };
    docsDirectory: boolean;
    adrDirectories: string[];
    adrCount: number;
  };
  setup: { dockerfile: boolean; envExample: boolean; makefile: boolean; devcontainer: boolean };
}

export interface HistoryHotspot {
  path: string;
  commits: number;
  churn: number;
  complexity: number | null;
  score: number | null;
}

export interface HistorySummary {
  available: boolean;
  reason: string | null;
  source: "git" | "github-api" | null;
  commitQuality: CommitQuality | null;
  pullRequests: PullRequestSummary | null;
  releases: ReleaseSummary | null;
  shallow: boolean | null;
  commitsAnalyzed: number | null;
  window: { first: string | null; last: string | null };
  contributors: { name: string; commits: number; share: number }[];
  topAuthorShare: number | null;
  hotspots: HistoryHotspot[];
  moduleOwnership: {
    moduleId: string;
    path: string;
    topAuthor: string;
    share: number;
    commits: number;
  }[];
  limitations: string[];
}

export interface DependencySecuritySummary {
  assessed: boolean;
  reason: string | null;
  source: string | null;
  packagesChecked: number | null;
  vulnerabilities: number | null;
}

export interface ToolRun {
  assessed: boolean;
  reason: string | null;
  tool: string;
  findings: number | null;
}

export interface SecuritySummary {
  dependencies: DependencySecuritySummary;
  secrets: ToolRun[];
  workflows: ToolRun;
  statement: string;
}

export interface RulesSummary {
  evaluated: boolean;
  source: string | null;
  rules: { id: string; type: string; severity: Severity; description: string | null }[];
  violations: number | null;
  baseline: { source: string | null; suppressed: number } | null;
}

export interface Metrics {
  files: FileMetrics[];
  topFunctions: FunctionMetric[];
  functionCount: number;
  complexityDistribution: { low: number; moderate: number; high: number; veryHigh: number } | null;
  duplication: {
    assessed: boolean;
    reason: string | null;
    duplicatedLines: number | null;
    totalLines: number | null;
    ratio: number | null;
    groups: {
      lines: number;
      occurrences: { path: string; startLine: number; endLine: number }[];
    }[];
  };
  totals: { codeLines: number; commentLines: number; blankLines: number };
}

export interface RepositoryInfo {
  source: { type: "local" | "github"; location: string; ref: string | null };
  name: string;
  commitSha: string | null;
  defaultBranch: string | null;
  totalFiles: number;
  analyzedFiles: number;
  totalBytes: number;
  truncated: boolean;
  /** Source and test files in a recognized programming language. */
  codeFiles: number;
  /** Code files that a language analyzer processed. */
  analyzedCodeFiles: number;
  productionFiles: number;
  testFiles: number;
}

export interface ExecutiveSummary {
  headline: string;
  overview: string[];
  strengths: string[];
  concerns: string[];
  nextSteps: string[];
}

export interface CommitQuality {
  sampled: number;
  conventionalShare: number;
  descriptiveShare: number;
  genericShare: number;
  avgSubjectLength: number;
}

export interface PullRequestSummary {
  sampled: number;
  merged: number;
  medianHoursToMerge: number | null;
}

export interface ReleaseSummary {
  count: number;
  latestDate: string | null;
}

export interface TestCoverageSummary {
  ingested: boolean;
  source: string | null;
  format: "lcov" | "istanbul-summary" | "cobertura" | null;
  lineRate: number | null;
  filesMatched: number | null;
  reason: string | null;
}

export interface RiskFactor {
  name: string;
  value: number | null;
  percentile: number | null;
  note: string;
}

export interface RiskFile {
  path: string;
  moduleId: string | null;
  risk: number;
  confidence: Confidence;
  factors: RiskFactor[];
  drivers: string[];
  explanation: string;
}

export interface RiskSummary {
  assessed: boolean;
  reason: string | null;
  method: string;
  files: RiskFile[];
}

export interface BlastRadiusEntry {
  path: string;
  directDependents: number;
  transitiveDependents: number;
  runtimeTransitive: number;
  modulesAffected: string[];
  entrypointsAffected: string[];
  maxDepth: number;
}

export interface Report {
  schemaVersion: string;
  status: ReportStatus;
  repository: RepositoryInfo;
  scope: {
    languages: {
      language: string;
      files: number;
      codeLines: number;
      supportLevel: SupportLevel;
      analyzerId: string | null;
    }[];
    excluded: { reason: string; count: number }[];
    budgets: Record<string, number>;
  };
  detection: DetectionSummary;
  coverage: CoverageRecord[];
  files: FileRecord[];
  graph: GraphModel;
  externalDependencies: ExternalDependencyRecord[];
  unresolvedImports: Dependency[];
  metrics: Metrics;
  findings: Finding[];
  recommendations: Recommendation[];
  scores: ScoreRecord[];
  executiveSummary: ExecutiveSummary;
  testCoverage: TestCoverageSummary;
  risk: RiskSummary;
  blastRadius: BlastRadiusEntry[];
  practices: PracticesSummary;
  history: HistorySummary;
  security: SecuritySummary;
  rules: RulesSummary;
  methodology: {
    profile: string;
    profileHash: string;
    configHash: string;
    scoringVersion: string;
    glossaryVersion: string;
  };
  reproducibility: {
    toolVersion: string;
    schemaVersion: string;
    commitSha: string | null;
    toolVersions: Record<string, string | null>;
    startedAt: string;
    finishedAt: string;
    /** SHA-256 over sorted paths, sizes and the contents of analyzed source and test files. */
    inputDigest: string;
    contentHash: string;
  };
  limitations: string[];
}
