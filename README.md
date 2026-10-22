# RepoLens (working name)

An open-source repository intelligence platform. It analyzes GitHub repositories and local codebases
and produces explainable, evidence-based engineering reports: architecture, dependencies, code
quality, security signals, testing and CI practices, documentation, and Git history.

Status: Phase 1 (engine and CLI) built. The web app arrives in Phase 2. See `docs/PROJECT_STATE.md`.

## Principles

1. Evidence first: every finding links to files, locations, and the rule that produced it.
2. Honest coverage: unsupported languages get partial reports, and missing data is never shown as zero.
3. Deterministic core: no paid LLM or proprietary service is required.
4. Safe by default: analyzed repositories are untrusted input and their code is never executed.
5. Local first: the CLI works fully offline and the web app is built on the same engine.

## Repository layout

| Path | Purpose |
|---|---|
| `packages/core` | Engine, intermediate representation, graph, rules, report schema |
| `packages/cli` | Command line interface |
| `apps/web` | Web application (created in Phase 2) |
| `scripts` | Benchmark and comparison helpers |
| `fixtures` | Hand-built repositories with known ground truth |
| `docs` | Plan, specification, architecture, ADRs, security, UX, phases, prompts |
| `docs/academic` | College submission documents (filled only after completion) |

## Quick start

```bash
corepack enable
pnpm install
pnpm check
pnpm repolens analyze . --offline -f markdown,html -o repolens-report
```

CLI reference: `docs/reference/cli.md`. Architecture rules: `docs/reference/rules.md`. Report schema: `packages/core/schema/report.schema.json`.

## Start here

Read `docs/README.md`, then `docs/PROJECT_STATE.md`, then the current phase file in `docs/phases`.

## License

Apache-2.0. See `LICENSE`.
