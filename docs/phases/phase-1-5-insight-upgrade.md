# Phase 1.5: Insight upgrade

Status: **built and verified in the build environment (238 tests), owner verification open (see DOTEST.md at the repository root).**
This phase sits between Phase 1 and Phase 2. It exists because the first real report (Provenance) showed that the facts were right but the explanation, the
grouping and the insight were not good enough for a product.

## 1. Goal

Make the engine's output decision-ready: correct wording and grouping, plain-language explanations for every term, an executive summary, and the new insight features
(risk index, blast radius, pull request guardian, trend, commit and pull request signals, coverage ingestion, diagram exports). Report schema moves to 0.2.0.

## 2. What was fixed (from the Provenance review)

| # | Problem | Fix |
|---|---|---|
| 1 | "91 of 182 files analyzed" looked like half was skipped | Separate counts: total, code, production, test, analyzed code files |
| 2 | "Upgrade 11 vulnerable dependencies" | Recommendations grouped per package with nearest fixed version and update size |
| 3 | Fixed versions mixed across packages | Only fixed versions of the affected package are used |
| 4 | Unclear advisory attribution | Aliases (CVE) shown, and a note when OSV lists other affected packages |
| 5 | Effort "low" for a major upgrade | Effort derived from the version jump (patch low, minor medium, major high) |
| 6 | Development tools dominated the security score | Lockfile `dev` flag read, dev-only advisories count 40 percent, text says so |
| 7 | README install section false positive | Wider heading match plus install commands found anywhere in the README |
| 8 | Architecture 100 with high confidence although Python is level 2 and rules missing | Confidence capped by language support level, "Inputs used" shown |
| 9 | Shell coverage 0 percent, `<anonymous>`, "Testing ci" | n/a (detection only), names like `useCallback() callback`, proper labels from the glossary |
| 10 | HTML lacked detection info, summary, explanations | Executive summary, detection, tooltips, glossary, module map |
| 11 | Advisory ids as titles, community note listed all five files | Plain titles, present and missing files named |
| 12 | No history for remote repositories | GitHub API activity: commits, contributors, commit quality, pull requests, releases |

## 3. What was added

| Feature | Command or section | Where in code |
|---|---|---|
| Glossary (what, technical, why it matters, how calculated, how to improve) for every label | `repolens glossary`, HTML tooltips, JSON export | `packages/core/src/glossary` |
| Executive summary | First section of every report | `report/summary.ts` |
| Explainable scoring: inputs used, points to gain per input, how to improve | Scores section | `scoring/score.ts`, `report/common.ts` |
| Cross-signal risk index | Risk section, `risk` in JSON | `risk/risk.ts` |
| Blast radius | `repolens impact report.json <file>`, section in report | `graph/impact.ts` |
| Pull request guardian | `repolens pr --base main` | `pr/guardian.ts`, `git/worktree.ts` |
| Repository trend and drift | `repolens trend` | `trend/trend.ts` |
| Coverage ingestion (LCOV, Istanbul summary, Cobertura) | `--coverage`, auto-detect | `metrics/coverage.ts` |
| Commit message quality, pull request and release signals | History section | `git/quality.ts`, `git/activity.ts` |
| Diagram exports (Mermaid, DOT, SVG, file drill-down) | `repolens graph` | `report/diagram.ts` |
| README section detection | Practices | `practices/detect.ts` |

## 4. What this phase does not do (honest limits)

- The risk index ranks files, it does not predict defects. It is a transparent formula, not a trained model.
- Blast radius uses static imports. Dynamic and framework-driven links are not included.
- The pull request guardian compares two analyses. It does not run the project's tests or build.
- Trend samples evenly spaced commits and analyzes structure only (offline, no secrets or vulnerability checks per snapshot).
- Commit and pull request signals describe habits, not quality of the code.
- Remote history is a sample of recent commits, not the full history, and has no file level churn without a clone.
- A GitHub Action and automatic PR comments are Phase 3.
- Interactive graphs, downloads and the designed UI are Phase 2.

## 5. Owner checklist

1. Wait until Phase 1 is merged into `main` (the delivery script refuses a dirty tree and is built for the Phase 1 state).
2. Apply with the git flow in `docs/workflow/git-flow-phase-1-5.md`.
3. Do `DOTEST.md`, sections 1 to 8 first.
4. Save before and after results in `docs/evaluation/results/p15-provenance.md`.
5. Update `docs/PROJECT_STATE.md`, mark P1.5 items in the backlog, confirm ADR 0017 and ADR 0018.
6. Open the Phase 2 prompt (`docs/prompts/phase-2-prompt.md`), follow `docs/prompts/HANDOFF.md`, and start Phase 2 in a new chat.

## 6. Exit criteria

| Criterion | Status |
|---|---|
| All 12 review fixes implemented and tested | Done |
| Glossary entry for every dimension, input and key term, with all five answers | Done (tested) |
| Executive summary, explanations, risk, blast radius, diagrams in all report formats | Done |
| `pr`, `trend`, `impact`, `graph`, `glossary` commands with tests | Done |
| Schema 0.2.0 published and validated on every generated report | Done |
| Fixture accuracy 1.0 including blast radius ground truth | Done |
| DOTEST sections 1 to 8 verified by owner | **Open** |
| Provenance before and after recorded | **Open** |

## 7. Prompt: resume Phase 1.5 in a new chat

```text
Project: RepoLens, open-source repository intelligence platform (TypeScript monorepo). I am the sole developer.
Read first: CLAUDE.md, docs/PROJECT_STATE.md, docs/phases/phase-1-5-insight-upgrade.md, docs/learning/phase-1-5-insight-upgrade.md, DOTEST.md,
docs/reference/cli.md, docs/reference/report-schema.md, docs/adr/0017-*.md, docs/adr/0018-*.md.
We are finishing Phase 1.5. The code is built and tested without network access. I am running DOTEST.md and will paste outputs or errors.
For each problem: find the root cause, fix it with a small change plus a test, update the docs and docs/learning/phase-1-5-insight-upgrade.md if behavior
changes, run pnpm check, and tell me exactly what to rerun. Do not claim anything that was not run. No em dashes.
```

## 8. Prompt: start Phase 2

Use the full prompt in `docs/prompts/phase-2-prompt.md` (and the checklist in `docs/prompts/HANDOFF.md`).
