# Repository structure (target by end of Phase 3)

```text
repolens/
  apps/
    web/                    Next.js app (Phase 2)
    worker/                 Node worker using core (Phase 2)
  packages/
    core/
      src/
        acquisition/        local, GitHub archive, safe extraction, git history
        detect/             languages, frameworks, manifests, file classification
        analyzers/
          js-ts/            TypeScript compiler API based analyzer
          python/           Tree-sitter based analyzer
          generic/          Level 1 fallback
        ir/                 entities, ids, schema (Zod)
        graph/              builder, SCC, metrics, modules
        metrics/            loc, complexity, duplication
        rules/              parser, evaluator, baseline
        security/           osv, gitleaks, workflows
        practices/          ci, tests, docs, adr
        git/                churn, hotspots, ownership
        scoring/            profiles, aggregation, confidence
        report/             json, markdown, html, templates
        index.ts
    cli/                    commands, flags, exit codes, progress
    schema/                 generated JSON Schema and TS types for consumers (optional split)
  fixtures/                 hand-built repositories with expected results
  docs/                     this documentation
  scripts/                  maintenance and benchmark scripts
  .github/                  workflows, templates
```

Rules:

- `apps/*` may depend on `packages/*`. Never the reverse.
- `apps/web` imports only the report types and schema, not engine internals.
- Each analyzer folder has `manifest.ts`, `README.md`, tests, and fixtures references.
- Adding a language means adding a folder under `analyzers/` and registering it. No core changes.
