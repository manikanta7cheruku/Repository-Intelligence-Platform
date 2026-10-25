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
- `{ "report": <Report 0.4.0> }` once, last
- `{ "error": string }` instead of a report

Errors before streaming: 400 (invalid body or URL, with the reason), 429 (rate limit), 405 for GET.

Safety: only https `github.com` repositories (no credentials, ports or IP hosts), budgets (download 200 MB, 8,000 analyzed files, 50 s analysis timeout), cancellation when the client disconnects, temporary files deleted in `finally`,
20 requests per address per 10 minutes by default (`RIP_MAX_ANALYSES_PER_10_MIN`, best effort per instance, not applied to local use without a forwarded address).

How the repository is read: the archive is streamed from `codeload.github.com` (no REST API quota) and unpacked on the fly. Dependency folders, binary and media files and oversized files are skipped and counted, so a large download does not fail.
If the file or size budget runs out the report is marked partial and says how much was left out.

History: totals (commits, first and last commit, contributors, merged pull requests, releases) come from the GitHub API and are exact. Commit message quality uses the latest 100 commits. File level history needs a local checkout.
The GitHub REST API allows only 60 requests per hour without a token and each analysis uses about 7. Set `GITHUB_TOKEN` (5,000 per hour) for any real use. Without it history shows as not assessed with that reason, the rest of the report still works.

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
| `GITHUB_TOKEN` | Recommended. Read-only token for the GitHub API (history and pull request signals). Copy `apps/web/.env.example` to `apps/web/.env.local` |
| `RIP_MAX_ANALYSES_PER_10_MIN` | Optional. Analyses per address per 10 minutes on a hosted deployment (default 20) |

## Commands

```bash
pnpm --filter @repolens/web exec next dev -p 3100   # development
pnpm --filter @repolens/web build                   # production build
node scripts/make-sample-report.mjs                 # regenerate the sample report (after pnpm build)
```
