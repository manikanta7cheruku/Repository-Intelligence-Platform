import { REPORT_SCHEMA_VERSION } from "./types.js";

type S = Record<string, unknown>;

const str = (extra: S = {}): S => ({ type: "string", ...extra });
const int = (extra: S = {}): S => ({ type: "integer", ...extra });
const num = (extra: S = {}): S => ({ type: "number", ...extra });
const bool = (): S => ({ type: "boolean" });
const en = (values: string[]): S => ({ type: "string", enum: values });
const arr = (items: S): S => ({ type: "array", items });
const nul = (s: S): S => {
  const t = s.type as string;
  const out: S = { ...s, type: [t, "null"] };
  if (Array.isArray(s.enum)) out.enum = [...(s.enum as unknown[]), null];
  return out;
};
const obj = (props: Record<string, S>, optional: string[] = []): S => ({
  type: "object",
  properties: props,
  required: Object.keys(props).filter((k) => !optional.includes(k)),
  additionalProperties: false,
});
const record = (valueSchema: S): S => ({ type: "object", additionalProperties: valueSchema });

const severity = en(["critical", "high", "medium", "low", "info"]);
const confidence = en(["high", "medium", "low"]);
const origin = en(["observed", "inferred", "documented"]);
const supportLevel = { type: "integer", enum: [1, 2, 3, 4, 5] };

const location = obj({ path: str(), startLine: nul(int()), endLine: nul(int()) });
const evidence = obj({
  kind: en(["location", "graph-path", "tool-output", "doc-reference", "metric"]),
  refs: arr(str()),
  note: nul(str()),
});
const finding = obj({
  id: str({ pattern: "^RL-[A-Z0-9-]+-[0-9a-f]{6,}$" }),
  title: str(),
  category: en([
    "architecture",
    "quality",
    "security",
    "practices",
    "documentation",
    "history",
    "analysis",
  ]),
  ruleId: str(),
  severity,
  confidence,
  origin,
  classification: nul(en(["confirmed", "probable", "heuristic", "needs-manual-review"])),
  explanation: str(),
  evidence: arr(evidence),
  locations: arr(location),
  remediation: str(),
  limitations: arr(str()),
  tags: arr(str()),
});
const dependency = obj({
  fromPath: str(),
  specifier: str(),
  kind: en(["import", "require", "dynamic", "type-only", "reexport"]),
  line: int(),
  resolution: en(["resolved", "external", "unresolved", "ignored"]),
  toPath: nul(str()),
  externalPackage: nul(str()),
  builtin: bool(),
  reason: nul(str()),
});
const scoreInput = obj({
  name: str(),
  impact: nul(num({ minimum: 0, maximum: 100 })),
  raw: nul(num()),
  normalized: nul(num()),
  weight: num(),
  available: bool(),
  note: str(),
});
const confidenceEnum = confidence;
const riskFactor = obj({
  name: str(),
  value: nul(num()),
  percentile: nul(num({ minimum: 0, maximum: 1 })),
  note: str(),
});
const toolRun = obj({ assessed: bool(), reason: nul(str()), tool: str(), findings: nul(int()) });

export const reportSchema: S = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://repolens.dev/schema/report-0.2.0.json",
  title: "RepoLens report",
  description:
    "Evidence-based repository analysis report. Missing values are null with a reason, never zero.",
  ...obj({
    schemaVersion: str({ pattern: "^0\\.2\\.[0-9]+$" }),
    status: en(["complete", "partial", "failed"]),
    repository: obj({
      source: obj({ type: en(["local", "github"]), location: str(), ref: nul(str()) }),
      name: str(),
      commitSha: nul(str()),
      defaultBranch: nul(str()),
      totalFiles: int({ minimum: 0 }),
      analyzedFiles: int({ minimum: 0 }),
      totalBytes: int({ minimum: 0 }),
      truncated: bool(),
      codeFiles: int({ minimum: 0 }),
      analyzedCodeFiles: int({ minimum: 0 }),
      productionFiles: int({ minimum: 0 }),
      testFiles: int({ minimum: 0 }),
    }),
    scope: obj({
      languages: arr(
        obj({
          language: str(),
          files: int(),
          codeLines: int(),
          supportLevel,
          analyzerId: nul(str()),
        }),
      ),
      excluded: arr(obj({ reason: str(), count: int() })),
      budgets: record(num()),
    }),
    detection: obj({
      packageManagers: arr(str()),
      manifests: arr(str()),
      lockfiles: arr(str()),
      frameworks: arr(obj({ name: str(), evidence: str() })),
      entrypoints: arr(obj({ path: str(), reason: str() })),
      buildTools: arr(str()),
      runtimes: arr(str()),
      license: obj({ file: nul(str()), spdxGuess: nul(str()) }),
    }),
    coverage: arr(
      obj({
        analyzerId: str(),
        language: str(),
        supportLevel,
        filesEligible: int(),
        filesAnalyzed: int(),
        ratio: nul(num({ minimum: 0, maximum: 1 })),
        limitations: arr(str()),
      }),
    ),
    files: arr(
      obj({
        id: str({ pattern: "^f_[0-9a-f]{12}$" }),
        path: str(),
        language: nul(str()),
        kind: en(["source", "test", "config", "docs", "generated", "vendored", "binary", "other"]),
        kindReason: str(),
        bytes: int(),
        lines: nul(int()),
        codeLines: nul(int()),
        analyzed: bool(),
        notAnalyzedReason: nul(str()),
      }),
    ),
    graph: obj({
      nodes: arr(obj({ id: str(), path: str(), moduleId: str(), fanIn: int(), fanOut: int() })),
      edges: arr(
        obj({
          from: str(),
          to: str(),
          weight: int(),
          typeOnly: bool(),
          occurrences: arr(
            obj({
              line: int(),
              specifier: str(),
              kind: en(["import", "require", "dynamic", "type-only", "reexport"]),
            }),
          ),
        }),
      ),
      modules: arr(
        obj({
          id: str(),
          path: str(),
          kind: en(["directory", "package"]),
          fileCount: int(),
          loc: int(),
          fanIn: nul(int()),
          fanOut: nul(int()),
          instability: nul(num({ minimum: 0, maximum: 1 })),
          origin,
        }),
      ),
      moduleEdges: arr(obj({ from: str(), to: str(), weight: int() })),
      cycles: arr(
        obj({ scope: en(["file", "module"]), members: arr(str()), size: int(), typeOnly: bool() }),
      ),
      levels: arr(obj({ moduleId: str(), level: int(), origin, confidence })),
      entrypointReachable: obj({
        analyzable: bool(),
        reachableFiles: nul(int()),
        unreachableFiles: nul(int()),
      }),
      resolution: obj({
        internalImports: int(),
        resolved: int(),
        unresolved: int(),
        external: int(),
        ratio: nul(num({ minimum: 0, maximum: 1 })),
      }),
    }),
    externalDependencies: arr(
      obj({ name: str(), builtin: bool(), importingFiles: int(), importCount: int() }),
    ),
    unresolvedImports: arr(dependency),
    metrics: obj({
      files: arr(
        obj({
          fileId: str(),
          path: str(),
          codeLines: int(),
          commentLines: int(),
          blankLines: int(),
          functions: int(),
          maxComplexity: nul(int()),
          totalComplexity: nul(int()),
        }),
      ),
      topFunctions: arr(
        obj({
          fileId: str(),
          path: str(),
          name: str(),
          line: int(),
          endLine: int(),
          complexity: int(),
          approximate: bool(),
        }),
      ),
      functionCount: int(),
      complexityDistribution: nul(
        obj({ low: int(), moderate: int(), high: int(), veryHigh: int() }),
      ),
      duplication: obj({
        assessed: bool(),
        reason: nul(str()),
        duplicatedLines: nul(int()),
        totalLines: nul(int()),
        ratio: nul(num({ minimum: 0, maximum: 1 })),
        groups: arr(
          obj({
            lines: int(),
            occurrences: arr(obj({ path: str(), startLine: int(), endLine: int() })),
          }),
        ),
      }),
      totals: obj({ codeLines: int(), commentLines: int(), blankLines: int() }),
    }),
    findings: arr(finding),
    recommendations: arr(
      obj({
        rank: int({ minimum: 1 }),
        title: str(),
        rationale: str(),
        priority: num(),
        findingIds: arr(str()),
        effort: nul(en(["low", "medium", "high"])),
      }),
    ),
    scores: arr(
      obj({
        dimension: en([
          "architecture",
          "maintainability",
          "security-hygiene",
          "testing-ci",
          "documentation",
          "maintenance-activity",
        ]),
        state: en(["assessed", "not-assessed"]),
        value: nul(num({ minimum: 0, maximum: 100 })),
        confidence: nul(confidence),
        coverage: nul(num({ minimum: 0, maximum: 1 })),
        weightCoverage: nul(num({ minimum: 0, maximum: 1 })),
        reason: nul(str()),
        inputs: arr(scoreInput),
      }),
    ),
    practices: obj({
      ci: obj({ providers: arr(str()), workflowFiles: arr(str()) }),
      tests: obj({
        frameworks: arr(str()),
        testFiles: int(),
        sourceFiles: int(),
        testToSourceFileRatio: nul(num()),
        coverageReport: en(["ingested", "not-ingested"]),
      }),
      quality: obj({
        linters: arr(str()),
        formatters: arr(str()),
        typeCheckers: arr(str()),
        strictTypeScript: nul(bool()),
      }),
      documentation: obj({
        readme: obj({
          path: nul(str()),
          words: nul(int()),
          headings: arr(str()),
          hasInstall: nul(bool()),
          hasUsage: nul(bool()),
          sections: arr(str()),
          links: int(),
        }),
        files: obj({
          contributing: bool(),
          codeOfConduct: bool(),
          security: bool(),
          changelog: bool(),
          license: bool(),
        }),
        docsDirectory: bool(),
        adrDirectories: arr(str()),
        adrCount: int(),
      }),
      setup: obj({
        dockerfile: bool(),
        envExample: bool(),
        makefile: bool(),
        devcontainer: bool(),
      }),
    }),
    history: obj({
      available: bool(),
      reason: nul(str()),
      source: nul(en(["git", "github-api"])),
      commitQuality: nul(
        obj({
          sampled: int(),
          conventionalShare: num(),
          descriptiveShare: num(),
          genericShare: num(),
          avgSubjectLength: num(),
        }),
      ),
      pullRequests: nul(obj({ sampled: int(), merged: int(), medianHoursToMerge: nul(num()) })),
      releases: nul(obj({ count: int(), latestDate: nul(str()) })),
      shallow: nul(bool()),
      commitsAnalyzed: nul(int()),
      window: obj({ first: nul(str()), last: nul(str()) }),
      contributors: arr(obj({ name: str(), commits: int(), share: num() })),
      topAuthorShare: nul(num()),
      hotspots: arr(
        obj({
          path: str(),
          commits: int(),
          churn: int(),
          complexity: nul(int()),
          score: nul(num()),
        }),
      ),
      moduleOwnership: arr(
        obj({ moduleId: str(), path: str(), topAuthor: str(), share: num(), commits: int() }),
      ),
      limitations: arr(str()),
    }),
    security: obj({
      dependencies: obj({
        assessed: bool(),
        reason: nul(str()),
        source: nul(str()),
        packagesChecked: nul(int()),
        vulnerabilities: nul(int()),
      }),
      secrets: arr(toolRun),
      workflows: toolRun,
      statement: str(),
    }),
    rules: obj({
      evaluated: bool(),
      source: nul(str()),
      rules: arr(obj({ id: str(), type: str(), severity, description: nul(str()) })),
      violations: nul(int()),
      baseline: nul(obj({ source: nul(str()), suppressed: int() })),
    }),
    executiveSummary: obj({
      headline: str(),
      overview: arr(str()),
      strengths: arr(str()),
      concerns: arr(str()),
      nextSteps: arr(str()),
    }),
    testCoverage: obj({
      ingested: bool(),
      source: nul(str()),
      format: nul(en(["lcov", "istanbul-summary", "cobertura"])),
      lineRate: nul(num({ minimum: 0, maximum: 1 })),
      filesMatched: nul(int()),
      reason: nul(str()),
    }),
    risk: obj({
      assessed: bool(),
      reason: nul(str()),
      method: str(),
      files: arr(
        obj({
          path: str(),
          moduleId: nul(str()),
          risk: num({ minimum: 0, maximum: 100 }),
          confidence: confidenceEnum,
          factors: arr(riskFactor),
          drivers: arr(str()),
          explanation: str(),
        }),
      ),
    }),
    blastRadius: arr(
      obj({
        path: str(),
        directDependents: int(),
        transitiveDependents: int(),
        runtimeTransitive: int(),
        modulesAffected: arr(str()),
        entrypointsAffected: arr(str()),
        maxDepth: int(),
      }),
    ),
    methodology: obj({
      profile: str(),
      profileHash: str(),
      configHash: str(),
      scoringVersion: str(),
      glossaryVersion: str(),
    }),
    reproducibility: obj({
      toolVersion: str(),
      schemaVersion: str(),
      commitSha: nul(str()),
      toolVersions: record({ type: ["string", "null"] }),
      startedAt: str(),
      finishedAt: str(),
      inputDigest: str({ pattern: "^[0-9a-f]{64}$" }),
      contentHash: str(),
    }),
    limitations: arr(str()),
  }),
};

export interface ValidationIssue {
  path: string;
  message: string;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(declared: string, actual: string): boolean {
  return declared === actual || (declared === "number" && actual === "integer");
}

/** Validates data against the JSON Schema subset used by this project. */
export function validateAgainst(
  schema: S,
  data: unknown,
  path = "$",
  issues: ValidationIssue[] = [],
): ValidationIssue[] {
  const declared =
    schema.type === undefined ? null : ([] as string[]).concat(schema.type as string | string[]);
  const actual = typeOf(data);
  if (declared && !declared.some((d) => typeMatches(d, actual))) {
    issues.push({ path, message: `expected ${declared.join(" or ")}, got ${actual}` });
    return issues;
  }
  if (typeof data === "number" && !Number.isFinite(data)) {
    issues.push({ path, message: "number is not finite" });
    return issues;
  }
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(data)) {
    issues.push({ path, message: `value ${JSON.stringify(data)} not in enum` });
  }
  if (
    typeof data === "string" &&
    typeof schema.pattern === "string" &&
    !new RegExp(schema.pattern).test(data)
  ) {
    issues.push({ path, message: `string does not match ${schema.pattern}` });
  }
  if (typeof data === "number") {
    if (typeof schema.minimum === "number" && data < schema.minimum)
      issues.push({ path, message: `below minimum ${schema.minimum}` });
    if (typeof schema.maximum === "number" && data > schema.maximum)
      issues.push({ path, message: `above maximum ${schema.maximum}` });
  }
  if (Array.isArray(data) && schema.items) {
    data.forEach((item, i) => validateAgainst(schema.items as S, item, `${path}[${i}]`, issues));
  }
  if (actual === "object") {
    const record = data as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, S>;
    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in record))
        issues.push({ path: `${path}.${key}`, message: "required property missing" });
    }
    for (const [key, value] of Object.entries(record)) {
      if (key in props) validateAgainst(props[key] as S, value, `${path}.${key}`, issues);
      else if (schema.additionalProperties === false)
        issues.push({ path: `${path}.${key}`, message: "unexpected property" });
      else if (typeof schema.additionalProperties === "object") {
        validateAgainst(schema.additionalProperties as S, value, `${path}.${key}`, issues);
      }
    }
  }
  return issues;
}

export interface ReportValidation {
  valid: boolean;
  issues: ValidationIssue[];
}

/** Schema validation plus the invariants that JSON Schema cannot express. */
export function validateReport(report: unknown): ReportValidation {
  const issues = validateAgainst(reportSchema, report);
  if (issues.length === 0) {
    const r = report as {
      schemaVersion: string;
      scores: {
        dimension: string;
        state: string;
        value: number | null;
        reason: string | null;
        confidence: string | null;
      }[];
      reproducibility: { schemaVersion: string };
      graph: { resolution: { internalImports: number; ratio: number | null } };
    };
    if (
      r.schemaVersion !== REPORT_SCHEMA_VERSION ||
      r.reproducibility.schemaVersion !== REPORT_SCHEMA_VERSION
    ) {
      issues.push({
        path: "$.schemaVersion",
        message: `unsupported schema version, expected ${REPORT_SCHEMA_VERSION}`,
      });
    }
    r.scores.forEach((s, i) => {
      if (s.state === "not-assessed" && (s.value !== null || !s.reason)) {
        issues.push({
          path: `$.scores[${i}]`,
          message: "not-assessed score must have null value and a reason",
        });
      }
      if (s.state === "assessed" && (s.value === null || s.confidence === null)) {
        issues.push({
          path: `$.scores[${i}]`,
          message: "assessed score needs a value and confidence",
        });
      }
    });
    if (r.graph.resolution.internalImports === 0 && r.graph.resolution.ratio !== null) {
      issues.push({
        path: "$.graph.resolution.ratio",
        message: "ratio must be null when there are no internal imports",
      });
    }
  }
  return { valid: issues.length === 0, issues };
}
