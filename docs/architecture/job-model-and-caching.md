# Job model and caching

## Job lifecycle

`queued` to `acquiring` to `detecting` to `analyzing` to `scoring` to `reporting` to `complete`.
Terminal alternatives: `partial`, `failed`, `cancelled`, `expired`.

| Concern | Decision |
|---|---|
| Queue | pg-boss on Postgres, one queue per job type (analyze, cleanup) |
| Concurrency | Worker concurrency 1 to 2 jobs, configurable by memory |
| Idempotency | Job key is a hash of normalized repository identity, commit SHA, profile, config hash, and engine version. Matching complete jobs return the existing report |
| Budgets | Defaults: 60 MB archive, 20,000 files, 5 MB per file analyzed, 120 s analysis wall time, 10 min total. All configurable per profile and per deployment |
| Cancellation | User cancel sets a flag. Worker checks between stages and passes AbortSignal into analyzers |
| Retries | Only transient network errors during acquisition, at most 2, with backoff |
| Partial results | Stage failures add coverage gaps. The report status becomes `partial` |
| Cleanup | Workspace deleted on completion, failure, or cancel. A scheduled job removes orphans |

## Caching (MVP)

| Cache | Key | Where | Invalidation |
|---|---|---|---|
| Result cache | Job key above | Postgres | Engine version change, config change, retention expiry |
| Archive cache | owner, repo, commit SHA | Local disk in the worker, bounded size, LRU | Commit SHA is immutable, evict by size |
| OSV lookup cache | package, version | Postgres or local file | TTL 24 hours |
| CLI cache | `.repolens-cache/` by file content hash | Local disk | Analyzer version or config change |

Incremental analysis in the CLI (reanalyze only changed files) is a Phase 1 stretch. The design keeps
per-file IR fragments keyed by content hash so it can be added without redesign.

## Cross-user isolation

Reports are addressed by unguessable ids (random 128-bit). The anonymous MVP has no private data
because only public repositories are accepted. Private analysis stays in the CLI. When accounts are
added (Later), every row gets an owner id and every query is scoped by it.
