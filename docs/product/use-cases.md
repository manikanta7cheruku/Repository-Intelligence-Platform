# Use cases

Actors: **Learner**, **Maintainer**, **Reviewer**, **CI system**, **Hosted service** (Phase 2). Status shows where each
use case works today. Acceptance statements are testable.

| ID | Use case | Actor | CLI (Phase 1) | Web (Phase 2) |
|---|---|---|---|---|
| UC-01 | Understand an unfamiliar repository | Learner | Yes | Planned |
| UC-02 | Analyze a public GitHub repository | Learner, Reviewer | Yes | Planned |
| UC-03 | Analyze a private local repository offline | Maintainer | Yes | n/a |
| UC-04 | Enforce architecture rules in CI | Maintainer, CI | Yes | n/a |
| UC-05 | Adopt rules on a legacy codebase with a baseline | Maintainer | Yes | Planned |
| UC-06 | Compare two analyses (drift over time) | Maintainer, Reviewer | Yes (`diff`) | Planned |
| UC-07 | Find risky files (hotspots) | Maintainer | Yes | Planned |
| UC-08 | Review security signals | Maintainer | Yes | Planned |
| UC-09 | Judge project practices | Reviewer | Yes | Planned |
| UC-10 | Export a report | Reviewer | Yes | Planned |
| UC-11 | Handle unsupported or huge repositories honestly | All | Yes | Planned |
| UC-12 | Reproduce a report | Reviewer | Yes | Planned |
| UC-13 | See what a change could break (blast radius) | Maintainer, Reviewer | Yes (`impact`) | Planned |
| UC-14 | Guard a pull request against architectural regressions | Maintainer, CI | Yes (`pr`) | Phase 3 (GitHub Action) |
| UC-15 | See how the repository evolved | Maintainer, Reviewer | Yes (`trend`) | Planned |
| UC-16 | Find the riskiest files to change | Maintainer, Learner | Yes (risk section) | Planned |
| UC-17 | Understand every term and how to improve a score | Everyone | Yes (glossary, summary) | Planned (hover help) |

## UC-01 Understand an unfamiliar repository

- Actor: Learner. Precondition: a local clone or a public URL.
- Main flow: run `repolens analyze <target> -f markdown,html`; open the report; read Summary (scores with coverage and confidence), Scope and coverage (languages and support levels), Architecture (modules, levels, cycles), Project detection (frameworks, entrypoints), top recommendations.
- Alternate: unsupported languages: the report says which languages only received line counts.
- Postcondition: the learner knows the stack, the entrypoints, the module layout, and which findings to read first.
- Acceptance: the report lists entrypoints and modules for fixtures `ts-layered-clean` and `py-package` exactly as in their `expected.json`.

## UC-02 Analyze a public GitHub repository

- Main flow: `repolens analyze https://github.com/owner/repo --ref v1.2.0`. The CLI validates the URL, downloads the archive within budgets, extracts it safely, analyzes, writes the report.
- Alternate: repository is private or missing: clear error, exit code 3. Rate limited: message suggests `GITHUB_TOKEN`. Invalid or non-GitHub URL: usage error, exit 2.
- Acceptance: SSRF and traversal tests (`github.test.ts`, `tar.test.ts`) pass; no repository code is executed.

## UC-03 Analyze a private repository offline

- Main flow: `repolens analyze . --offline`. No data leaves the machine. Vulnerability matching reports "not assessed (offline)".
- Acceptance: `status` is `complete`, `security.dependencies.assessed` is false with a reason, the security score is not assessed when the remaining inputs are insufficient.

## UC-04 Enforce architecture rules in CI

- Preconditions: `repolens.rules.yaml` in the repository.
- Main flow: CI runs `repolens analyze . --offline -q`. Exit code 1 when a rule is violated (or when `--fail-on` severity is met). The report artifact shows each violation with the import line.
- Acceptance: fixture `ts-violation` fails with three violations, `ts-layered-clean` passes. This repository does this to itself in CI.

## UC-05 Adopt rules on a legacy codebase

- Main flow: run once with `--write-baseline repolens.baseline.json` (exit 0), commit the baseline, then run CI with `--baseline repolens.baseline.json`. Only new violations fail.
- Acceptance: CLI test "exits 1 when rules are violated and 0 after the violations are baselined".

## UC-06 Compare two analyses

- Main flow: `repolens diff before/report.json after/report.json`. Output lists new and resolved findings, added and removed dependency edges and modules, new external packages, and score deltas. Missing values stay n/a.
- Acceptance: `diffReports` tests; identical reports produce an empty diff.

## UC-07 Find risky files

- Main flow: analyze a local Git repository (history enabled by default). Hotspots combine commit frequency and function complexity percentiles. Ownership concentration is shown as a continuity signal.
- Alternate: shallow clone or no Git: history says why it is unavailable or limited.
- Acceptance: git history tests build a real repository and verify counts, hotspots, ownership and limits.

## UC-08 Review security signals

- Main flow: the Security section lists each check (OSV, secrets, workflows) with assessed or not, the findings classified confirmed, probable or heuristic, and the statement that results are signals, not a verdict.
- Acceptance: seeded fixtures; secrets never appear in output; offline and failure paths are "not assessed", never zero.

## UC-09 Judge project practices

- Main flow: the Practices data covers CI, tests, linters, formatters, type checking, README sections, contribution and governance files, decision records. Findings use neutral wording and say that absence in the repository root is not proof of absence elsewhere.

## UC-10 Export a report

- Main flow: `-f json,markdown,html`, or `repolens report report.json --format html`. HTML is self-contained, has no scripts, and escapes all content.
- Acceptance: hostile-content tests (SA-06, SA-07).

## UC-11 Handle unsupported or huge repositories

- Unsupported: Level 1 report, architecture not assessed. Huge: budgets truncate the walk, the report is `partial`, a finding explains the cut, `--fail-on-partial` exits 4.
- Acceptance: pipeline tests for truncation, analyzer failure and aborted runs.

## UC-12 Reproduce a report

- Main flow: the report stores tool and schema versions, configuration hash, scoring profile hash, commit, input digest and a content hash. Running again on the same input gives the same content hash.
- Acceptance: determinism tests including a different file creation order.

## UC-13 See what a change could break

- Main flow: `repolens impact report.json <file>` lists direct and indirect dependents, modules and entrypoints that could be affected. The report also lists the files with the largest blast radius.
- Acceptance: fixture `ts-blast-radius` has hand-computed values (for example the hub file has 3 direct and 4 total dependents, 4 modules and 1 entrypoint) that the harness checks.

## UC-14 Guard a pull request

- Main flow: in CI or locally `repolens pr --base main --fail-on-regression`. The check analyzes base and head with the same rules and prints a verdict with reasons, new violations, cycles, packages, complexity and blast radius of the changed files.
- Alternate: compare two saved reports. Refs that do not exist give exit code 3. Invalid refs give a usage error.
- Acceptance: tests with real Git repositories cover regressed, improved and unchanged verdicts, clean-up of worktrees and unsafe refs.

## UC-15 See how the repository evolved

- Main flow: `repolens trend --points 6` shows size, modules, edges, cycles, third-party packages and scores over time, with drift and plain-language insights.
- Acceptance: tests build a growing repository and check the points, drift, insights and that the working tree and worktree list are untouched.

## UC-16 Find the riskiest files

- Main flow: the Risk section ranks files by a blend of complexity, dependents, change frequency and test linkage or coverage, with reasons. Needs at least two factors.
- Acceptance: unit tests for ranking, test linkage effects, coverage effects, confidence by factor count and determinism.

## UC-17 Understand every term

- Main flow: the report opens with an executive summary, shows "Inputs used" and "Points to gain" for each score, explains terms on hover (HTML) or in a glossary, and lists what to do to enable a not-assessed score.
- Acceptance: glossary completeness test and report tests.
