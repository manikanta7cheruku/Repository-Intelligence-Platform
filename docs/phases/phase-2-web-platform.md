# Phase 2: Web platform

Status: **first release built and verified locally (2026-10-25). Deployment to Vercel, real phone review, automated accessibility audit and Playwright journeys are open.**
Plan and review of the original prompt: `docs/phases/phase-2-plan-v2.md`. Design system: `docs/ux/web-design-system.md`. Reference: `docs/reference/web-app.md`.
Decisions: ADR 0019 (stateless web), ADR 0020 (graph rendering), ADR 0021 (export pipeline), all Proposed until the owner accepts them.

## Goal

A professional web application on top of the engine: analyze a public GitHub repository or open a local `report.json`, read a briefing with a proof for every score,
explore structure and change impact on interactive graphs, and download every chart and diagram. Mobile responsive, light and dark, keyboard friendly.

## What was built

| Area | Delivered | Where |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict, plain CSS with tokens, no UI framework | `apps/web` |
| Contract | The web reads only report JSON 0.4.0 and the glossary through `@repolens/core/browser` (pure modules). Hosted analysis uses `@repolens/core/server` | `packages/core/src/browser.ts`, `server.ts` |
| Start page | GitHub URL form with real streamed stages and cancel, open a local report (drag and drop), reports saved in the browser, live sample report | `app/page.tsx`, `components/analyze-form.tsx` |
| Report sections | Briefing (scores with proof panels, reliability), Priorities, Structure (Map and Ledger), Impact, Risk, Quality, Security, Practices, History, Rules, Compare, Export | `components/sections/*` |
| Graphs | Layered interactive map: pan, zoom, search, cycle filter, hover and focus highlight of dependents and dependencies, module to file drill-down, keyboard navigation, ledger alternative | `components/layered-graph.tsx`, `lib/layout.ts` |
| Charts | Complexity distribution, hotspot scatter, language bar, curve sparklines in score proofs | `components/charts.tsx` |
| Downloads | Export menu on every chart and graph: SVG, PNG at 2x, PDF (print dialog), JSON, Mermaid and DOT for graphs. Light variant with title, legend, repository, commit, date and tool | `components/export-menu.tsx`, `lib/svg.ts` |
| Explanations | Glossary terms explained on hover, focus and tap, searchable Glossary page with deep links, "not assessed" always shows its reason | `components/ui.tsx`, `glossary-view.tsx` |
| Other pages | How it works (exportable pipeline diagram), Run it free, Privacy, Settings (theme, density, reduced motion, saved reports), command palette (Ctrl or Cmd K) | `app/*` |
| API | `POST /api/analyze`: URL validation reused from the engine, body size limit, per-address rate limit (best effort per instance), time and size budgets, NDJSON progress stream, cancellation | `app/api/analyze/route.ts` |
| Security | Strict Content-Security-Policy and headers, no raw HTML from reports (React escaping only), hostile export text escaped | `next.config.ts` |
| Tests | 13 web tests: contract (sample validates, proof fields, glossary ids used in the UI exist, no em dashes), layout (cycles, overlap, determinism), export (light literal colors, escaping), API route (SSRF style URLs refused, bad bodies, rate limit) | `apps/web/src/lib/web.test.ts` |

## Verified (commands run on 2026-10-25, Windows, Node 24.10.0)

- `pnpm check`: Biome (including `apps`), build (core, CLI, `next build`), typecheck, 253 tests pass.
- End to end through the real route: analyzing `github.com/manikanta7cheruku/provenance` streamed all 11 stages in 5.3 s and the saved report opened in the browser.
- Browser checks in the preview pane: Briefing and score proof, Structure map (29 modules, 92 edges), module drill-down data, SVG and PNG export (valid light SVG, PNG blob created), command palette,
  Impact graph, Risk scatter, Glossary deep link, mobile layout at 390 px, CSP header present on the production build.
- Layout speed (Node, synthetic graphs): 60 nodes 7 ms, 1,000 nodes 5 ms, 5,000 nodes 32 ms. This is layout only. Rendering of thousands of nodes was **not** measured because the interface caps the map at 60 modules,
  70 files or 90 impact nodes by design.

## Real repository results (2026-10-25, through `POST /api/analyze`, no GitHub token)

| Repository | Files analyzed | Commits (exact) | Contributors | Merged PRs (exact) | Result |
|---|---|---|---|---|---|
| manikanta7cheruku/NEURAL-SHELL | 482 | 1,539 | 3 | 17 | complete, 11 s, 162 known vulnerable dependency versions |
| manikanta7cheruku/Repository-Intelligence-Platform | 359 | 65 | 2 | 7 | complete, 4 s |
| pallets/flask | 231 | 5,562 | 100 or more | 1,623 | complete, 8 s |
| expressjs/express | 216 | 6,183 | 100 or more | 579 | complete, 5 s |
| sindresorhus/got | 135 | 1,788 | 100 or more | 549 | complete, 5 s |
| tiangolo/fastapi | 3,045 | not assessed | not assessed | not assessed | complete in 8 s, history missing because the unauthenticated GitHub API limit (60 per hour) was used up |
| vercel/next.js | 8,000 of about 33,000 | not requested | | | partial in 27 s, says how much was left out |

Problems found by the owner on 2026-10-25 and their causes: history showed 284 commits for a repository with 1,539 (only a recent sample was counted), merged pull requests showed n/a (the sample report was made offline),
the RIP sample listed Go, Rust and Python (test fixture folders were counted as project code), some repositories failed with "archive exceeds the size budget" (the whole download was capped at 40 MB and held in memory) and
others failed or were slow (about 150 sequential advisory lookups took 50 s, and the in-memory rate limit allowed 6 analyses per 10 minutes even on a local machine, and the unauthenticated GitHub API limit is 60 per hour).
All fixed, see `docs/learning/phase-2-web-platform.md` section 5.

## Not done or not verified (honest list)

- **Not deployed.** Vercel limits (function duration, memory, bundle size, non-commercial terms) are unverified. `maxDuration` is set to a conservative 60 s. The engine's function bundle size on Vercel is unmeasured.
- **No automated accessibility audit.** axe and Lighthouse were not run. Keyboard paths and ARIA roles were implemented and spot checked by reading the DOM, not by a screen reader.
- **No real phone review.** Mobile was checked in an emulated 390 px viewport only.
- **No Playwright journeys and no visual regression tests** (tests are unit and contract level).
- **Graph benchmark P2-01 is partial** (layout timing only). ADR 0012 stays open for any graph that needs more than the caps allow.
- **Rate limiting is per server instance** and resets when it restarts. A shared store is needed for a hard limit.
- **Hosted analysis has no file level history** (GitHub API sample only). Local reports have it.
- Cut by the owner decision (stateless first release): saved server history, share links, accounts, YAML editor, OAuth star, PWA, worker and queue.

## Exit criteria

| Criterion | Status |
|---|---|
| Hosted flow for a public repository works end to end | Done locally, not deployed |
| Local report mode works with no upload | Done |
| Briefing with proof for every score | Done |
| Interactive graphs with search, filter, drill-down, keyboard use | Done (map and impact), measured only for layout speed |
| Every chart and diagram downloadable | Done (SVG, PNG, PDF through print, JSON, Mermaid, DOT) |
| Every glossary term explained in place | Done for terms rendered with the Term component, full Glossary page |
| Dark and light themes, mobile design | Done, owner review on a real phone open |
| axe clean and Lighthouse accessibility 95 or higher | **Open** |
| Playwright main journey in CI | **Open** |
| `pnpm check` green in CI | Passing locally, CI run after merge |
| Deployed on Vercel | **Open** |

## Owner checklist

1. Merge the Phase 2 pull request, then `pnpm install` and `pnpm check`.
2. Run the site locally: `pnpm --filter @repolens/web exec next dev -p 3100` and open http://localhost:3100.
3. Deploy: import the repository in Vercel, root directory `apps/web` (the repository already has `apps/web/vercel.json`). Check the current plan limits first and record the date.
4. Open the site on your phone, test the bottom tabs, the evidence sheet and the map.
5. Run Lighthouse (accessibility) on the Briefing, Structure and Glossary pages and save the numbers in `docs/evaluation/results/p2-accessibility.md`.

## Prompt: resume Phase 2 in a new chat

```text
Project: RIP (Repository Intelligence Platform), TypeScript monorepo. I am the sole developer. Read CLAUDE.md, docs/PROJECT_STATE.md, docs/phases/phase-2-web-platform.md,
docs/phases/phase-2-plan-v2.md, docs/ux/web-design-system.md, docs/reference/web-app.md, docs/learning/phase-2-web-platform.md and ADRs 0019 to 0021.
Phase 2 first release is built. Continue with the open items in the "Not done" list (deployment, accessibility audit, Playwright journeys, graph benchmark). No em dashes, no template look.
Plan briefly, change little, run pnpm check, update PROJECT_STATE and the learning file, and tell me exactly what to verify.
```

## Prompt: start Phase 3

Use `docs/prompts/phase-3-prompt.md` (full prompt) after the Phase 2 exit criteria pass.
