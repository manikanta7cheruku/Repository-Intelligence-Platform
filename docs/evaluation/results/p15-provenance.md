# Phase 1.5 verification on Provenance

Run on 2026-10-25, Windows 11, Node 24.10.0, Git 2.51.0, against `github.com/manikanta7cheruku/provenance` at commit 1480893 (11 commits, 3 merged pull requests, 0 releases).
RepoLens commands were run exactly as listed in `DOTEST.md`. Items not run are listed at the end. Values below were read from the generated reports.

## Section 2: remote analysis

| Check | Result |
|---|---|
| Files line | "267 total, 158 code files (134 production, 24 test), 156 analyzed". The old "91 of 182" style wording is gone. |
| Executive summary | Present: names Python and TypeScript, FastAPI, React, SQLAlchemy, strengths, concerns, three next steps |
| Scores | Architecture 100 (medium), Maintainability 97, Security hygiene 91, Testing and CI 83, Documentation 75, Maintenance activity 55 |
| Vulnerabilities | 0 known (0 in development-only packages), so the grouping and 40 percent rule could not be observed on this snapshot. Earlier vite findings no longer exist in the repository. Unverified: the "launch-editor" attribution question. |
| Testing and CI label | Reads "Testing and CI" |
| Shell and PowerShell | "n/a (detection only)" |
| Risk and blast radius | Present, top file apps/web/src/lib/api.ts |
| History (GitHub API) | Assessed, commit quality 100 percent Conventional Commits, merged pull requests counted |

## Sections 3 to 8: local clone

| Section | Result |
|---|---|
| 3 History and risk | History source is Git, hotspots present, "frequently changed" appears in the risk drivers |
| 4 Blast radius | `impact` on apps/web/src/lib/api.ts: 10 direct and 35 total dependents, 4 modules. A text search for the import path found only 4 literal matches because other files use relative imports; the full 10 were not individually hand-verified. |
| 5 Diagrams | SVG, Mermaid, DOT and file-level drill-down all produced. Rendering in a browser or mermaid.live was not viewed. |
| 6 Rules | Clean tree: exit 0 and all 5 architecture inputs available. After adding `from pv_persistence import x` to a domain file: exit 1 with "Layer domain depends on disallowed layer persistence" at line 1. |
| 7 Pull request guardian | Cross-layer change: "regressed", exit 1 with `--fail-on-regression`. Comment-only change: "unchanged", exit 0. |
| 8 Trend | 4 samples (the first-parent history has 4 commits), growth and drift reported, working tree clean, one worktree listed. |
| 10 Secrets (built-in only) | A fake AKIA key was reported as a high finding and the value does not appear in any report file. Gitleaks was not installed. |

## Differences found and fixed

1. Windows checkouts used CRLF, so Biome reported 50 format errors on `main`. Fixed with `.gitattributes` (`eol=lf`).
2. Local history excluded merge commits (a path-limited `git log` prunes them) while the GitHub API source counted them, so Maintenance activity was "not assessed" locally (8 commits, below the 10 minimum) and scored 55 remotely (11). The API source now excludes merge commits, so both count the same way. Provenance therefore reports Maintenance activity as not assessed in both modes until it has 10 non-merge commits. This is the designed behavior, not a defect.
3. Executive summary said "1 function have very high complexity". Now "1 function has high or very high complexity".

## Not run

Sections 9 (coverage with a real report), 10 (Gitleaks binary), 11 (rate limit behavior without a token), 12 (second platform), the browser checks in sections 2, 5 and 13, and hand-verification of two OSV advisories.
