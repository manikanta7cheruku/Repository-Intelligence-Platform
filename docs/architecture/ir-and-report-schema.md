# Intermediate representation and report schema (v0.1.0, implemented)

Implemented in `packages/core/src/ir/types.ts` (types) and `packages/core/src/ir/schema.ts` (JSON Schema and
validator, see ADR 0015). The published schema is `packages/core/schema/report.schema.json` and `repolens schema`
prints it. The sections below describe the design. For exact fields read the types file. Changes follow semver:
additive within `0.1.x`, any breaking change bumps the minor version while the project is below 1.0.

## 1. Identifiers

- `fileId`: `f_` plus first 12 hex of SHA-256 of the normalized repo-relative path.
- `moduleId`: `m_` plus hash of the module path.
- `findingId`: `RL-<RULE>-<hash>` where hash derives from rule id, location, and evidence key. Stable across runs for the same code.
- `symbolId`: `s_` plus hash of fileId and qualified name.

## 2. Core entities (IR)

| Entity | Key fields |
|---|---|
| Repository | source (url or path), commitSha, ref, defaultBranch, acquiredAt, shallow (bool), sizeBytes |
| File | id, path, language, kind (source, test, config, docs, generated, vendored, binary), kindReason, loc, bytes, analyzed (bool), notAnalyzedReason |
| Module | id, path, kind (directory, package, workspace), fileIds, parentId |
| Symbol | id, fileId, name, kind (function, class, variable, type), exported (bool), range |
| Dependency | id, fromFileId, to (fileId, externalPackage, or unresolved), kind (import, require, dynamic, type-only, reexport), specifier, range, resolution (resolved, external, unresolved, ignored), origin |
| Metric | scope (file, module, repo), name, value, unit, method, analyzerId |
| Finding | see section 3 |
| Coverage | analyzerId, language, filesAnalyzed, filesEligible, limitations[] |
| Evidence | id, kind (location, snippet-hash, graph-path, tool-output, doc-reference), refs |

All entities are plain JSON. Source text is not stored in reports by default, only locations and short
redacted snippets when the profile allows.

## 3. Finding model

```json
{
  "id": "RL-ARCH-CYCLE-3fa9c2",
  "title": "Circular dependency between 4 modules",
  "category": "architecture",
  "ruleId": "arch.cycle",
  "severity": "medium",
  "confidence": "high",
  "origin": "observed",
  "explanation": "Template-generated text from structured evidence.",
  "evidence": [{ "kind": "graph-path", "refs": ["f_ab12", "f_cd34", "f_ef56", "f_ab12"] }],
  "locations": [{ "path": "src/a.ts", "startLine": 12, "endLine": 12 }],
  "remediation": "Extract the shared types into a module both sides import.",
  "limitations": ["Dynamic imports are not followed."],
  "tags": ["coupling"]
}
```

Severity: critical, high, medium, low, info. Confidence: high, medium, low.
Security findings add `classification`: confirmed, probable, heuristic, needs-manual-review.

## 4. Report envelope

```json
{
  "schemaVersion": "0.1.0",
  "status": "complete | partial | failed",
  "repository": {},
  "scope": { "languages": [], "supportLevels": {}, "budgets": {}, "truncated": false },
  "coverage": [],
  "scores": [
    {
      "dimension": "architecture",
      "value": null,
      "state": "not-assessed",
      "reason": "Fewer than 50 percent of sub-metrics available",
      "confidence": null,
      "inputs": []
    }
  ],
  "graph": { "nodes": [], "edges": [], "modules": [] },
  "metrics": [],
  "findings": [],
  "recommendations": [],
  "practices": {},
  "history": { "available": false, "reason": "Shallow clone" },
  "methodology": { "profile": "default", "configHash": "" },
  "reproducibility": { "toolVersion": "", "schemaVersion": "", "commitSha": "", "toolVersions": {}, "startedAt": "", "finishedAt": "" },
  "limitations": []
}
```

Rule: a numeric field that was not computed is `null` with a `reason`, never `0`.

## 5. Analyzer plugin interface (sketch)

```ts
interface AnalyzerPlugin {
  id: string;
  version: string;
  languages: string[];
  supportLevel: 1 | 2 | 3 | 4 | 5;
  capabilities: Capability[];
  limitations: string[];
  analyze(ctx: AnalysisContext, signal: AbortSignal): Promise<AnalyzerResult>;
}
```

`AnalyzerResult` returns IR fragments, coverage, and limitations. Plugins never write to disk outside
the workspace and never execute repository code.

## 6. Rules file (draft)

```yaml
version: 1
layers:
  - name: ui
    paths: ["src/ui/**"]
  - name: domain
    paths: ["src/domain/**"]
rules:
  - id: no-ui-in-domain
    description: Domain must not depend on UI
    forbid:
      from: domain
      to: ui
    severity: high
  - id: no-cycles
    forbid: cycles
    scope: modules
```

Violations are findings with graph-path evidence. A baseline file lists accepted finding ids so CI fails only on new violations.
