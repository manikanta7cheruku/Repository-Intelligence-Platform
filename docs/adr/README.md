# Architecture decision records

Status words: Proposed, Accepted, Rejected, Deferred, Superseded. Accepted means the owner approved it. Technical validation is tracked separately in each ADR.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-monorepo-typescript.md) | Monorepo with a TypeScript core | Accepted |
| [0002](0002-local-first-and-worker.md) | Local-first engine with a separate analysis worker | Accepted |
| [0003](0003-safe-acquisition.md) | Safe repository acquisition | Accepted |
| [0004](0004-parsing-strategy.md) | Parsing strategy by language | Accepted |
| [0005](0005-ir-report-schema.md) | Versioned IR and report schema with Zod | Accepted |
| [0006](0006-postgres-only.md) | Postgres for data and queue | Accepted |
| [0007](0007-deterministic-scoring-no-llm.md) | Transparent scoring and deterministic explanations, no LLM | Accepted |
| [0008](0008-security-integrations.md) | Integrate established security tools, do not build SAST | Accepted |
| [0009](0009-web-stack.md) | Next.js on Vercel with a token-driven custom design system | Accepted |
| [0010](0010-license-apache-2.md) | License: Apache-2.0 | Accepted |
| [0011](0011-worker-hosting.md) | Worker hosting for hosted analysis | Proposed |
| [0012](0012-graph-library.md) | Graph rendering library | Proposed |
| [0013](0013-account-analysis-deferred.md) | Account and organization analysis deferred | Deferred |
| [0014](0014-testing-tooling.md) | Testing and tooling strategy | Accepted |
| [0015](0015-dependency-light-core.md) | Dependency-light core (schema validator and YAML subset) | Accepted |
| [0016](0016-module-inference-and-graph-scope.md) | Module inference rule and graph scope | Accepted |
| [0017](0017-report-schema-0-2-and-glossary.md) | Report schema 0.2.0 and a single glossary | Accepted |
| [0018](0018-risk-index-pr-guardian-trend.md) | Risk index, pull request guardian and trend | Accepted |

Template: [0000-template.md](0000-template.md)
