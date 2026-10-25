# Report schema reference (0.2.0)

The JSON report is validated against `packages/core/schema/report.schema.json` (also printed by `repolens schema`). This page explains the meaning of each top-level section for
people who build on the report, including the web app.

| Section | Meaning |
|---|---|
| `schemaVersion`, `status` | Version of the format. `complete` or `partial` (budget reached, analyzer failed, or required lookup failed) |
| `repository` | Source, commit, and file counts: `totalFiles`, `codeFiles`, `analyzedCodeFiles`, `productionFiles`, `testFiles` |
| `executiveSummary` | Headline, overview lines, strengths, concerns and next steps, written from report facts with fixed templates |
| `scores[]` | One per dimension: `value` (null when not assessed), `state`, `confidence`, `coverage`, `weightCoverage` (inputs used), `reason`, and `inputs[]` with `raw`, `normalized`, `weight`, `impact` (points to gain), `available`, `note`. Input names are glossary ids |
| `scope`, `coverage[]` | Languages with support levels, analyzer coverage. `ratio` is null for detection-only languages |
| `detection` | Package managers, frameworks, entrypoints, license |
| `graph` | `nodes`, `edges` (with line occurrences), `modules`, `moduleEdges`, `cycles` (with `typeOnly`), `levels`, `entrypointReachable`, `resolution` |
| `externalDependencies`, `unresolvedImports` | Third-party packages and unresolved internal imports |
| `metrics` | Per file lines and complexity, top functions, distribution, duplication, totals |
| `risk` | Method text and the top files by risk index with factors, drivers and explanation |
| `blastRadius[]` | Top files by dependents: direct, transitive, runtime-only, modules and entrypoints reached, depth |
| `findings[]` | id, title, category, rule id, severity, confidence, origin, classification, explanation, evidence, locations, remediation, limitations, tags |
| `recommendations[]` | Ranked, grouped actions with effort and finding ids |
| `practices`, `testCoverage` | CI, tests, linters, docs, README sections, ingested coverage |
| `history` | `source` (`git` or `github-api`), contributors, hotspots, ownership, `commitQuality`, `pullRequests`, `releases`, limitations |
| `security` | Per check status for OSV, secrets and workflows and the standing statement that results are signals |
| `rules` | Rules evaluated, violations, baseline |
| `methodology`, `reproducibility`, `limitations` | Profile hash, config hash, glossary version, tool versions, input digest, content hash, plain statements of limits |

Rules that never change: a value that was not computed is `null` with a reason, never `0`. Anything derived from a repository is untrusted text and must be escaped when displayed.

## Changes

| Version | Changes |
|---|---|
| 0.2.0 | Added file counts, `executiveSummary`, `testCoverage`, `risk`, `blastRadius`, `history.source`, `commitQuality`, `pullRequests`, `releases`, score `weightCoverage` and input `impact`, README `sections` and `links`, `methodology.glossaryVersion`, cycle `typeOnly` (already 0.1.0). Coverage report state `ingested` |
| 0.1.0 | First version |
