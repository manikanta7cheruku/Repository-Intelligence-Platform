# Phase 2 plan v2: review of the prompt and the updated plan

Status: proposal for owner approval. Nothing here is built. It reviews `docs/prompts/phase-2-prompt.md`, applies the owner's decisions (Vercel deployment, mobile responsive, black and white palette,
core analysis first, professional graphs with downloads) and replaces the parts of the prompt that would make the phase too large or too risky.
Items marked (unverified) must be checked before they are relied on.

## 1. Review of the Phase 2 prompt

### What is good (keep)
- The report JSON is the only contract between engine and web app. A contract test enforces it.
- Design honesty rules (never zero for missing data, no fake numbers, no fake charts) and the forbidden decoration list.
- Gate P2-01 (graph benchmark with numbers before choosing a library) and the rule "ask first about anything that costs money".
- Documents updated during the work, not at the end.

### What must change
| # | Problem in the prompt | Why it matters | Change |
|---|---|---|---|
| 1 | Stale facts: schema 0.2.0, 238 tests, "precision and recall 1.0" | The engine moved on: schema is now **0.3.0** (score proof), 240 tests, fixture **accuracy** 1.0 | Use the new numbers (section 8 gives the amendment text) |
| 2 | 20 screens and features, all "required" | One developer, deadline and weekly hours still unknown. A phase this large risks finishing nothing polished | Tier the scope: **Must**, **Should**, **Could** (section 4). Cut before starting, not at the end |
| 3 | Worker, pg-boss, Postgres, Docker for the first release | The engine analyzed Provenance (267 files) from a GitHub archive in **about 4.5 seconds** on the owner's machine (measured). A Vercel function may be enough for small public repositories, so a worker is not needed for the first release | Make the **worker optional**. Spike P2-00 decides with measurements (section 5) |
| 4 | "Verified limits" of Vercel Hobby (300 s, 2 GB, 4.5 MB, non-commercial) stated as verified | I did not verify them and they change | Treat as (unverified) until P2-00 checks the current official documentation and records the date |
| 5 | Visual direction is described only by prohibitions | Hard to approve or test | Section 3 gives concrete tokens, contrast ratios and layout rules |
| 6 | Mobile is one bullet in the structure section | The owner wants mobile-first responsive | Section 3.4 makes mobile a first-class design with its own navigation |
| 7 | "Core analysis first" is not stated | Users arrive wanting one answer: is this repository healthy, and what do I fix first | The **Briefing** is the home of every report (section 3.2) |
| 8 | OAuth star flow, PWA, saved history, share links, YAML editor, compare, language | Each is a project by itself | Moved to **Could** or later phases |
| 9 | Hosted flow stores reports in Postgres | Adds accounts, retention, deletion, privacy page, abuse handling | First release is **stateless**: the report lives in the browser (IndexedDB) and can be downloaded. Server storage is a later decision |
| 10 | "Billion dollar product" quality bar with a solo developer | Good ambition, but quality comes from fewer, finished things | Quality bars apply to the Must tier first |

### Contradictions and open facts
- The prompt forbids gradients of certain kinds, while the owner wants a white and black gradient palette. Resolved in section 3.1: grayscale tonal gradients only, used for surfaces, never as decoration.
- The prompt says "no mandatory paid service" while the stack lists Postgres hosting. Resolved by the stateless first release.
- Bundle size: the engine depends on the `typescript` package (large). Whether the engine fits a Vercel function bundle (unverified: limit must be checked) is a P2-00 question.
- A client-side engine run (WebAssembly or a browser build) is not possible today because the engine uses Node file and Git APIs. Browser-only analysis stays limited to **opening a report.json**.

## 2. Product shape

**One sentence:** paste a GitHub URL or open a report file, get a clear briefing on the health of a codebase with proof for every number, then explore structure, risk and change impact.

**Core user questions, in order** (the navigation follows them):
1. What is this repository and is the analysis reliable? (Briefing)
2. What should I fix first? (Priorities)
3. How is it structured? (Structure)
4. What could break if I change this file? (Impact)
5. Where are the risks and why? (Risk, Security)
6. How does it behave over time and across pull requests? (History, Compare)
7. What does this word mean? (Glossary, on hover everywhere)

## 3. Design plan

### 3.1 Visual direction: "monochrome precision"
- **Palette:** white to near-black tonal range. Gradients are grayscale only (for example a page background from #FFFFFF to #F4F4F5, or a dark surface from #0A0A0B to #141417), subtle, never colorful, never behind text that needs contrast.
- **One accent:** none for brand. Black (light theme) and white (dark theme) are the accent. Color is reserved for **meaning**: severity and status.
- **Typography is the design:** a refined sans for interface (system font stack first, one self-hosted variable font as an upgrade, license to verify), a real monospace for paths and code, tabular numerals for metrics. Scale 12, 14, 16, 20, 28, 40.
- **Shape and depth:** 1 px hairline borders, 6 px radius, no shadows except for overlays, no glow, no glass.
- **Motion:** 120 to 200 ms, ease-out, opacity and transform only, respects reduced motion. Skeletons match the final layout.

### Design tokens (contrast computed with the WCAG formula, not estimated)
| Token | Light | Dark | Contrast vs background |
|---|---|---|---|
| background | #FFFFFF | #0A0A0B | n/a |
| surface | #F4F4F5 | #141417 | n/a |
| text | #0A0A0B | #FAFAFA | 19.79 light, 18.96 dark |
| text muted | #52525B | #A1A1AA | 7.73 light, 7.72 dark |
| control border | #8A8A94 | #71717A | 3.42 light, 4.09 dark (needs 3 or more) |
| hairline (decorative) | #E4E4E7 | #27272A | decorative only |
| danger | #B42318 | #F97066 | 6.57 light, 7.10 dark |
| warning | #B54708 | #F79009 | 5.43 light, 8.43 dark |
| success | #067647 | #47CD89 | 5.69 light, 9.76 dark |
| info | #175CD3 | #84ADFF | 5.99 light, 8.86 dark |

Severity is never color alone: each level has a shape and a word (for example a filled square and "High").
Contrast must be re-checked in the finished UI with axe and manual review.

### 3.2 Information architecture ("Briefing first, Workbench second")
This merges concepts 1 and 2 of the prompt. Reports open as a **Briefing**, and every claim opens evidence.

```
Report
  Briefing      what it is, 6 scores with proof, top 3 priorities, reliability strip
  Priorities    ranked recommendations with effort and evidence
  Structure     Map (graph) | Ledger (table) of modules and files
  Impact        pick a file: what could break (direct, indirect, modules, entrypoints)
  Risk          ranked files with factor breakdown
  Security      vulnerabilities per package, secrets, workflow risks
  Practices     tests, CI, docs, community files as a checklist
  History       contributors, hotspots, commit quality, trend
  Rules         architecture rules and violations
  Compare       two reports, or a pull request verdict
  Export        every chart and the full report, all formats
  Glossary      searchable, five answers per term
```

**Persistent elements (desktop):**
- Left rail: the sections above (icon plus label, collapsible).
- Top bar: repository name, commit, analysis date, **command palette** (Cmd or Ctrl K) to jump to any file, module, finding or term, theme toggle, Export.
- Right **evidence drawer** that opens on any selection. It shows the evidence, the plain explanation, blast radius and remediation.
- Bottom **reliability strip**: status (complete or partial), coverage, confidence, what was not assessed, with a link to why.

**Score proof panel (new, from the engine work):** every score is a button. It opens a panel with the one-sentence basis, then each input as a row: what it measures, raw value, a small bar of the curve with a marker at the raw value, weight, points added, points to gain, evidence files. Provisional curves carry a visible "provisional" label.

### 3.3 Screens (wireframes in words)
**Landing:** headline stating what it does in one sentence; one input (GitHub URL) and an "Open report.json" drop zone side by side; below, a real sample report preview labeled "Sample: analysis of RepoLens itself"; a short "what it analyzes and what it does not" list; install command; GitHub link and star count. No fake numbers.

**Analyze and progress:** the input row stays at the top. Below it a vertical stage list (acquiring, detecting, analyzing, graph, metrics, rules, history, security, practices, scoring) with the current stage, elapsed time and Cancel. Partial results are not shown until the report is complete in the first release.

**Briefing:** headline sentence, a reliability line, six score rows (value, confidence, "why this score" button), "What looks good", "What needs attention", "Fix first" list of three with effort chips, then entry cards into Structure, Impact and Risk.

**Structure (Map):** module graph, levels as columns (the engine already computes levels). Click a module to expand into files. Filters: cycles only, type-only edges, language. Legend, search, zoom controls, keyboard navigation, and a Ledger toggle that shows the same data as a table.

**Impact:** a file picker (search), then a result card: direct dependents, all dependents, longest chain, modules and entrypoints affected, and a small graph of the affected set.

### 3.4 Mobile (its own design, 360 px and up)
- Bottom tab bar with five items: Briefing, Structure, Impact, Risk, More (opens a sheet with every other section).
- No left rail. The evidence drawer becomes a full-height bottom sheet with a drag handle and a close button.
- The map is **opt-in**: Structure shows a module list first (name, files, dependents), with "View map" opening a full-screen map with pinch zoom and a floating Reset button.
- Tables become stacked cards with the most important two fields visible and the rest behind "Details".
- Touch targets at least 44 px, thumb-reachable actions at the bottom, no hover-only information (tooltips become tap-to-open popovers).
- Tablet (768 to 1024 px): rail collapsed to icons, drawer as a side sheet.

### 3.5 Graphs and diagrams (planned professionally)
| View | Technique | Notes |
|---|---|---|
| Module map | Levels in columns, edges as orthogonal or smooth lines, cycles outlined | Aggregation by default (modules), drill-down to files, level of detail on zoom |
| Impact graph | Selected file in the center, dependents by distance rings | Highlights entrypoints |
| Score curve bars | Small inline SVG showing the curve and the raw marker | Part of score proof |
| Complexity distribution | Horizontal stacked bar of low, moderate, high, very high | Counts labeled, not only colors |
| Hotspots | Scatter: complexity vs change frequency, point size by churn | Labeled top points, keyboard-focusable |
| Trend | Small multiples (line per metric over commits) with sample size stated | Never connect fewer than 3 points as a trend |
| Language mix | Single stacked bar with labels | No pie charts |

**Library:** decided by gate P2-01 with numbers. Default expectation: Cytoscape.js or Sigma.js for the map and plain SVG for small charts. A charting library is only added if plain SVG becomes costly.

**Downloads (all client-side, nothing uploaded):** every visualization has an Export menu: **SVG**, **PNG at 2x**, **PDF** (print stylesheet first, library only if needed), **JSON data**, and for graphs **Mermaid** and **DOT** text (the engine already generates these). Exports use a light variant, include title, legend, repository, commit, date and tool version, and a consistent file name `repolens-<repo>-<view>-<yyyy-mm-dd>.<ext>`.

### 3.6 Explanations everywhere
Every glossary term has a hover, focus and tap explanation (plain meaning first, "More" opens the other four answers). Not assessed always shows the reason and what would enable it, in neutral gray, never as a red zero.

## 4. Scope tiers (to be cut by the owner before work starts)

**Must (first release):**
1. Design system and app shell, light and dark themes, responsive layout, mobile navigation
2. Landing with a real sample report
3. Analyze: GitHub URL and local `report.json` (browser only)
4. Progress with real stages and cancel
5. Briefing with score proof panels and reliability strip
6. Priorities
7. Structure (Map and Ledger) with exports
8. Impact (what could break)
9. Risk, Security, Practices pages
10. Explanations and Glossary
11. Export menu on every visualization
12. Accessibility, performance and states for all of the above, Playwright journey in CI, deployed on Vercel

**Should:** History and trend, Rules view, Compare and pull request verdict, "How RepoLens is built", "Run it free with GitHub" guide, command palette.

**Could (later or never):** saved server history and share links, YAML rules editor, GitHub OAuth star, PWA install, hosted worker with queue.

## 5. Architecture plan

### First release (recommended): stateless
```
Browser (Next.js on Vercel)  ->  /api/analyze (Vercel function)  ->  @repolens/core over a GitHub archive  ->  report JSON  ->  browser (IndexedDB, downloadable)
Browser  ->  open report.json from disk  ->  parsed and validated in the browser (no upload)
```
- Public GitHub repositories only, size and time budgets from the engine config, rate limit per visitor (design to be decided), SSRF-safe URL validation reused from the engine.
- No database, no queue, no accounts. This keeps the free tier realistic and removes retention and privacy obligations.

### Spike P2-00 (before the UX package is finalized, half a day)
Measure, do not assume: (1) does `@repolens/core` run inside a Vercel function and fit the bundle size limit, (2) analysis time for 3 public repositories of different sizes, (3) memory use, (4) current Vercel Hobby limits and terms from the official documentation, with the date. Outcomes:
- **Fits:** stateless architecture above.
- **Does not fit or too slow for large repositories:** add a worker (ADR 0011) using the cheapest option verified at that time, still without accounts.

### Contracts and safety (unchanged from the prompt)
The web app reads only report JSON 0.3.0 and the glossary export. Contract test required. Everything derived from a repository is untrusted text: React escaping, no raw HTML, strict CSP, no `dangerouslySetInnerHTML`, hostile-report tests (the engine already has fixtures with hostile names).

## 6. Quality bars
- Accessibility: WCAG 2.2 AA, axe in CI, keyboard-only pass, screen reader pass on Briefing and Structure, 200 percent zoom, reduced motion, forced colors.
- Performance: budgets set in P2-00 (suggested starting points, to be validated: LCP under 2.5 s on a mid phone profile, interaction under 200 ms, initial JavaScript under 200 KB gzip for the Briefing route). Large report test: a generated 5,000 file graph must stay interactive.
- Tests: unit, component, Playwright journeys (analyze to briefing, open local report, export a graph, mobile navigation), visual regression for Briefing and Structure, contract test.
- Honesty: never show missing data as zero, show coverage and confidence, never claim a repository is secure.

## 7. Order of work and branches
1. `docs/p2-ux-package`: this plan, wireframes, tokens, approval by the owner.
2. `spike/p2-00-feasibility`: function fit, timings, Vercel limits. Result recorded in `docs/evaluation/results/p2-00-feasibility.md`.
3. `feat/p2-01-graph-benchmark`: 1,000 and 5,000 node fixtures, frame rate and memory numbers, ADR 0012.
4. `feat/p2-02-app-shell`: Next.js app in `apps/web`, tokens, themes, layout, mobile navigation, contract test.
5. `feat/p2-03-analyze-progress`, `feat/p2-04-briefing-score-proof`, `feat/p2-05-structure-map`, `feat/p2-06-impact-risk`, `feat/p2-07-findings-pages`, `feat/p2-08-glossary-explanations`, `feat/p2-09-exports`.
6. Should tier items, then hardening (states, accessibility, performance), Playwright, deployment.
Each branch: Conventional Commits, `pnpm check` green, pull request, rebase and merge, docs updated in the same pull request.

## 8. Amendments to paste with the Phase 2 prompt
Paste this block **after** the prompt, or edit the prompt to match:

```text
AMENDMENTS (these override the prompt above where they differ)
1. Facts: the report schema is 0.3.0 (score proof fields: basis, description, curve, origin, contribution, evidence), there are 240 tests, fixture accuracy is 1.0. The engine analyzed a 267 file repository
   from a GitHub archive in about 4.5 seconds on my machine (measured).
2. Scope: use the tiers in docs/phases/phase-2-plan-v2.md (Must, Should, Could). Build only Must first. I will tell you my deadline and weekly hours before you plan the schedule.
3. Architecture: first release is stateless. Analysis runs in a Vercel function over a GitHub archive for public repositories, results live in the browser, no database, no queue, no accounts.
   Run spike P2-00 first and add a worker (ADR 0011) only if the measurements show it is needed. Treat all Vercel limits in the prompt as unverified until you check the current official documentation and record the date.
4. Design: monochrome precision. White and black with grayscale tonal gradients only, color only for severity and status, tokens from docs/phases/phase-2-plan-v2.md (contrast ratios were computed).
   Mobile is its own design with a bottom tab bar, bottom sheets and an opt-in map.
5. Core first: every report opens on the Briefing, and every score has a proof panel built from the 0.3.0 fields.
6. Graphs: every visualization has an Export menu (SVG, PNG 2x, PDF, JSON, plus Mermaid and DOT for graphs), all client-side.
7. Cut: server-side saved history, share links, YAML editor, OAuth star, PWA and language support are Could items and are not built unless I ask.
8. Process: reply to step (1) with your understanding, gaps and one question. Then deliver the UX package for my approval. Do not write UI code before I approve it.
```

## 9. Decisions needed from the owner
1. Academic deadline and weekly hours (decides how many Should items fit).
2. Approve the Must tier as the first release, or move items.
3. Approve the stateless architecture pending spike P2-00.
4. Product name (RepoLens is a working name, a rename is cheapest before Phase 2).
5. Whether the sample report on the landing page may be the analysis of this repository (recommended, it is real and public).
