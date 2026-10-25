# Fixtures

Hand-built repositories with known ground truth. Each directory has an `expected.json` that records
what a correct analysis must find: dependency edges, externals, unresolved imports, cycles, rule
violations, unsupported languages, and seeded security findings.

They are the dataset for the accuracy evaluation (`pnpm eval`) and for the regression tests
(`packages/core/src/eval/accuracy.test.ts`). The ground truth was written by hand from the fixture source,
not copied from tool output. Fixtures are small on purpose, so they prove correctness of mechanisms, not
performance. Real repositories are measured separately (docs/evaluation).

| Fixture | Purpose |
|---|---|
| ts-layered-clean | Clean layers, `.js` specifier mapped to `.ts`, type-only import, builtin and third-party externals, clean rules |
| ts-cycle | Runtime file cycle, type-only cycle, module cycle without file cycle |
| ts-violation | Layer violation, forbidden external, module cycle |
| ts-aliases | tsconfig paths, index files, re-exports, dynamic import, require, JSON import |
| ts-blast-radius | Known direct and transitive dependents, modules and entrypoints reached by a change |
| ts-monorepo | Workspace packages resolved without node_modules |
| ts-unresolved | Broken relative import, broken alias, syntax error |
| py-package | Python absolute and relative imports, TYPE_CHECKING, docstring false positives |
| py-cycle | Python relative cycle, parent-relative import, missing module |
| mixed-languages | Level 3, Level 2 and Level 1 languages together |
| unsupported-only | Honest report when no analyzer exists |
| security-seeded | GitHub Actions risks |

Secrets are never committed. Tests build secret-like strings at runtime so that secret scanning on this
repository stays clean.
