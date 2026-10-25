# Web app reference

Package `@repolens/web` in `apps/web`. Next.js 16 (App Router), React 19, TypeScript strict.

## Routes

| Route | Purpose |
|---|---|
| `/` | Start page: analyze a GitHub URL, open a local report, saved reports, sample |
| `/r/<id>/<section>` | Report. Sections: briefing, priorities, structure, impact, risk, quality, security, practices, history, rules, compare, export. `<id>` is `sample` or a random id of a report saved in this browser |
| `/glossary` | Every term, five answers each, deep links such as `/glossary#blast-radius` |
| `/how-it-works` | Pipeline diagram (downloadable), reading files, why no machine learning, limits, stack |
| `/run-free` | Four free ways to use RIP |
| `/settings`, `/privacy` | Display settings and saved reports, what is stored |
| `/api/analyze` | `POST` only |

Query: `/r/<id>/impact?file=<path>` selects a file.

## Data flow

```
GitHub URL -> POST /api/analyze -> @repolens/core/server (acquire, analyze, validate) -> NDJSON stream -> browser -> IndexedDB -> /r/<id>/...
report.json file -> browser (validate with the shared schema) -> IndexedDB -> /r/<id>/...
```

The web code imports only `@repolens/core/browser` (pure: types, glossary, schema validator, impact index, diagram text exporters, report diff). The API route imports `@repolens/core/server`. Nothing imports engine internals.

## API: POST /api/analyze

Request JSON: `{ "url": "https://github.com/owner/repo[/tree/branch]", "includeTests": true, "history": true }`, body at most 2,000 characters.

Response: `application/x-ndjson`, one JSON object per line:
- `{ "stage": "acquiring" | "detecting" | "analyzing" | "graph" | "metrics" | "rules" | "history" | "security" | "practices" | "scoring" | "reporting", "detail": string | null }`
- `{ "report": <Report 0.3.0> }` once, last
- `{ "error": string }` instead of a report

Errors before streaming: 400 (invalid body or URL, with the reason), 429 (rate limit), 405 for GET.

Safety: only https `github.com` repositories (no credentials, ports or IP hosts), size budgets (archive 40 MB, 8,000 files, 50 s analysis timeout), cancellation when the client disconnects, temporary files deleted in `finally`,
at most 6 requests per address per 10 minutes (best effort, per instance). `GITHUB_TOKEN` (optional environment variable) raises GitHub API limits and is never written to reports or logs.

## Local storage

IndexedDB database `rip-reports`, store `reports` (id, name, commit, savedAt, report). Local storage key `rip-settings` (theme, density, reduce motion, default export format). Nothing is sent to a server.

## Keyboard

| Key | Action |
|---|---|
| Ctrl or Cmd K | Open search (sections, files, findings, terms) |
| Escape | Close search, drawer, menus, popovers |
| Tab and Shift Tab | Move through controls and graph nodes |
| Arrow keys on a graph node | Move to the nearest node in that direction |
| Enter or Space on a node, row or term | Open |

## Environment

| Variable | Use |
|---|---|
| `GITHUB_TOKEN` | Optional read-only token for the GitHub API and archive download |

## Commands

```bash
pnpm --filter @repolens/web exec next dev -p 3100   # development
pnpm --filter @repolens/web build                   # production build
node scripts/make-sample-report.mjs                 # regenerate the sample report (after pnpm build)
```
