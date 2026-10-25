# Learning: Phase 2, Web platform

Status: first release built. This file explains what was built, why, where it lives, how it works, what went wrong and what is not verified. Numbers are only ones that were measured.

## 1. What the web app is

A Next.js application (`apps/web`) that turns the engine's report JSON into an interface: a briefing with a proof for every score, interactive dependency graphs, change impact, risk, security and practice pages, a glossary, and downloads for every chart.
It has no database. The server only runs the engine when you analyze a GitHub URL. Reports live in your browser.

## 2. How the pieces fit

| Piece | File | Idea |
|---|---|---|
| Contract | `packages/core/src/browser.ts` | A second entry point of the engine with only pure modules (types, glossary, schema validator, impact index, diagram text, report diff). The browser bundle cannot pull in file system or Git code |
| Server entry | `packages/core/src/server.ts` | Only what a request needs: acquire, analyze, validate. The Git worktree, pull request and trend modules are left out of the function bundle |
| API | `app/api/analyze/route.ts` | Validates the URL, applies budgets, runs the engine, streams stages as lines of JSON, then the report |
| Store | `lib/store.ts` | IndexedDB, keyed by a random id. Nothing leaves the browser |
| Shell | `components/report-shell.tsx` | Rail, top bar, content, reliability strip, tab bar on phones, evidence drawer, search |
| Graph | `lib/layout.ts`, `components/layered-graph.tsx` | Layered layout and an SVG canvas with pan, zoom, highlight, keyboard navigation |
| Exports | `lib/svg.ts`, `components/export-menu.tsx` | One stylesheet for screen and export, light palette for downloads |
| Proof | `components/sections/briefing.tsx` | Each score opens into its inputs, curves and evidence from the 0.3.0 report fields |

## 3. How the graph works

1. Nodes are modules (or files inside one module, or the files affected by a change). Edges mean "imports".
2. A depth first search finds back edges (the ones that close a cycle). They are ignored for layering so cycles cannot loop the algorithm.
3. Longest-path layering puts each node one column to the right of everything that imports it. So importers are on the left, dependencies on the right.
4. Within a column nodes are ordered by repeated barycenter sweeps (average position of neighbors) to reduce crossing edges.
5. Edges are cubic curves. Edges that point backwards (cycles) bulge to the right and are drawn in the danger color.
6. `d3-zoom` handles pan, wheel zoom and pinch. Hover or focus highlights incoming edges (info color) and outgoing edges (dark), and dims everything else.
7. The same layout is serialized to a standalone SVG for export, with literal light colors.

## 4. How a score proof is shown

The engine writes, for each score, a `basis` sentence and, for each input, a description, the curve anchors, whether the curve is a convention or provisional, the points it adds and up to five evidence items.
The page draws the curve as a tiny line with a marker at the raw value, so the reader sees why 0 cycles gives 100 points. Inputs that could not be measured are listed as unavailable and excluded, never zero.

## 5. Mistakes and fixes during the build

- Screenshots of the preview timed out repeatedly because the window was hidden. Checks fell back to reading the DOM through scripts and retrying screenshots.
- The first graph fit shrank a 9 column graph to a tenth of its size, unreadable. Fix: never shrink below 72 percent on first view, let the user pan, and offer "Show everything".
- The Impact graph dimmed all indirect dependents because the selected file counted as a hover focus. Fix: the impact view passes no selection.
- Module drill-down disappeared when the drawer closed because the button depended on the selection. Fix: drill state comes from the URL (`?module=`) and the drawer links to it.
- A shell here-document corrupted several large files. Fix: write files with the editor tool.
- The core `index` pulled the whole project into the server function trace (build warning). Fix: a dedicated `server` entry.

### Data accuracy problems found by real use (2026-10-25)

- **284 commits instead of 1,539.** The API history read only the latest 300 commits and called that the total. Now the total is read exactly (one commit per page, the page count of the last link), plus first and last commit dates, contributors (contributors endpoint) and merged pull requests (search total). Message quality still uses the latest 100 commits and says so.
- **Merged pull requests n/a for this repository.** The bundled sample was generated offline. Local analyses now also read pull request and release totals from the GitHub API when the origin remote is on GitHub and the network is allowed.
- **Wrong languages (Go, Rust, Python).** They were test fixture folders. A new file kind `fixture` keeps `fixtures`, `__fixtures__` and `testdata` folders out of languages, scores and the graph.
- **"Archive exceeds the size budget".** The archive was downloaded fully into memory and capped at 40 MB. Now it is streamed and unpacked on the fly, dependency folders and media files are skipped, and only a huge analyzable size makes the report partial instead of failing.
- **Slow and failing analyses.** Advisory details were fetched one after another (about 50 s for one repository). They now run 16 at a time (about 9 s for the same result). The local rate limit of 6 per 10 minutes is gone for local use.
- **GitHub API limit.** Without a token the API allows 60 requests per hour and an analysis uses about 7. This cannot be fixed in code. Set `GITHUB_TOKEN`.

## 6. What is not verified

No deployment, so Vercel limits, bundle size and cold start are unknown. No axe or Lighthouse run, no screen reader pass, no real phone, no Playwright journeys, no frame rate measurement for rendered graphs.
The rate limit is per server instance. The contrast ratios are computed, not audited in the finished interface.

## 7. College questions and answers

**1. Why Next.js?** One codebase gives static marketing pages, interactive client pages and a serverless API route, with TypeScript end to end. The report pages are client components because they work on data stored in the browser.

**2. Why Vercel?** It runs Next.js with no server to manage and has a free plan for non-commercial use. Its limits (duration, memory, bundle size) are unverified here and must be checked before relying on it.

**3. Why no database in the first release?** Fewer moving parts and no obligation to store, protect or delete user data. The engine analyzes typical repositories in seconds, so a stateless route is enough until measurements say otherwise (ADR 0019).

**4. When would you add a worker and a queue?** If real repositories exceed the function time or memory limit, or if jobs must run longer than a request. ADR 0011 stays open for that.

**5. How does the web app stay decoupled from the engine?** It reads only the versioned report JSON and the glossary through a browser-safe entry point, and a contract test validates the bundled sample against the schema.

**6. Why two engine entry points (`browser` and `server`)?** The browser must never bundle file system or Git code, and the server function should not bundle modules it never calls. Two small entry points make both properties checkable.

**7. How does the API report progress?** It streams newline-delimited JSON. Each line is a stage name, the last line is the report or an error. The browser reads the stream and ticks the stage list.

**8. How is cancellation handled?** The browser aborts the fetch. The server listens to the request's abort signal and passes it to the engine, which stops between stages.

**9. How do you stop someone from using the API to attack other sites?** The URL must be https, on github.com, without credentials, ports or IP addresses. The server only downloads from GitHub and never fetches arbitrary addresses. Tests cover lookalike hosts and local files.

**10. What does the rate limit protect and what are its limits?** It slows repeated analysis from one address (6 per 10 minutes). It is in memory per server instance, so it resets and can be bypassed across instances. A hard limit needs a shared store.

**11. Where are reports stored?** In the browser's IndexedDB, under a random id. A report can be downloaded and reopened. There is no sharing by link in this release.

**12. How is hostile repository content rendered safely?** All text is rendered through React, which escapes it. No raw HTML is injected from reports. Exports escape titles and labels. The Content-Security-Policy blocks remote scripts. A test checks that script tags in a title are escaped.

**13. Why a custom graph instead of Cytoscape or Sigma?** The graphs are small by design (aggregated modules, capped files), the layout needed to be deterministic and exportable, and every node needed to be a focusable element. A library can be added if uncapped graphs are required (ADR 0020).

**14. How is the layered layout computed?** Depth first search removes back edges, longest-path layering assigns columns, barycenter sweeps order each column. All steps are deterministic and tested.

**15. How do you handle cycles in layering?** Back edges found by the search are ignored when assigning columns, so the algorithm always ends. They are still drawn, in the danger color.

**16. How does the graph stay usable for large repositories?** Aggregation (modules first), caps (60 modules, 70 files, 90 impact nodes), search, a cycles-only filter, drill-down into one module, and a table view of the same data.

**17. Is the graph accessible?** Each node is focusable, has an accessible name, opens with Enter, and arrow keys move to neighbors. A table alternative shows the same modules. Screen reader behavior was not tested.

**18. How do downloads work without a server?** SVG is serialized in the browser. PNG draws that SVG on a canvas at 2x. PDF opens the SVG in a hidden frame and calls the print dialog. Nothing is uploaded (ADR 0021).

**19. Why do exports use a different color palette?** Exports must read well in documents, so they use a light palette with literal colors. On screen the same class rules use CSS variables so the theme applies.

**20. How is the glossary connected to the interface?** The glossary is exported by the engine and imported by the web app. A `Term` component shows the plain meaning on hover, focus or tap, and links to the full entry. A test fails if the interface uses a term id that does not exist.

**21. What does "not assessed" look like and why?** A dashed neutral block with the reason and, when known, what would enable it. Missing data is never shown as zero, because zero would claim a measurement that did not happen.

**22. How is the interface kept from looking like a template?** Restraint and structure: a monochrome palette with color only for meaning, type as the main design tool, a left rail that follows the questions people ask, a briefing before a dashboard, proof panels instead of gauges, and no decorative effects.

**23. How is dark mode done without a flash?** A tiny script in the document head reads the saved preference and sets the theme before the first paint. Colors are CSS variables.

**24. How does the mobile design differ from desktop?** A bottom tab bar replaces the rail, the evidence drawer becomes a bottom sheet, tables become stacked cards, and the same graph canvas supports touch pan and pinch zoom. Real phone testing is still open.

**25. What does the evidence drawer do?** It opens on any selected finding, file, module or term and shows the evidence, explanation, impact and remediation in one place, so no page has to carry all that detail.

**26. How was accessibility handled and what was not checked?** Semantic landmarks, labels, focus rings, keyboard paths, reduced motion, severity as word plus shape, computed contrast ratios. Not run: axe, Lighthouse, screen readers, 200 percent zoom review.

**27. What is a Content-Security-Policy and what does yours allow?** A header that lists where scripts, styles, images and connections may come from. Here scripts and styles come from the site itself (inline allowed for Next.js hydration and the theme script), connections only to the site and the GitHub API, no frames, no objects.

**28. How was the web app tested?** Unit and contract tests (sample validates, proof fields exist, glossary ids exist, no em dashes, layout properties, export escaping, API route validation and rate limit), plus manual checks in a browser for the main flows. No end-to-end or visual regression suite yet.

**29. Why does the sample report come from this repository?** It is real, public and shows every feature. The script anonymizes author names and replaces the local path with the repository URL. It is clearly labeled as a sample.

**30. What are the main gaps?** Not deployed, hosting limits unverified, no automated accessibility audit, no Playwright journeys, graph rendering performance not measured, in-memory rate limit, provisional score curves inherited from the engine.

**31. Why not use machine learning in the interface or analysis?** Explainability, no labeled data, repeatable results, privacy and exactness (see `docs/learning/00-master-college-qa.md` and ADR 0007).

**33. Why was the commit count wrong at first and how is it exact now?** Sampling the latest 300 commits cannot give a total. Asking the API for one commit per page makes the page count of the last link equal to the total number of commits, in one request.

**34. How does a download larger than memory get analyzed?** The archive is read as a stream, decompressed as it arrives and cut into tar entries. Only files worth analyzing are written to disk. Everything else is counted and discarded without being held in memory.

**35. Why are test fixtures not part of the language list?** They are sample projects used by tests, not code of the project. Counting them would claim languages the project does not use.

**36. Why is the GitHub token important?** Without a token GitHub allows 60 API requests per hour per address. Each analysis needs about 7, so a few analyses use it up. With a token the limit is 5,000 per hour.

**37. How do you know the analysis is accurate?** By comparing it with answers produced another way. For one real repository the Python import graph was recomputed with Python's own `ast` module (717 of 717 edges equal, same cycles), JavaScript and TypeScript imports with a separate extractor (224 of 224 and 153 of 153), blast radius with an own reachability search, commit and churn numbers with `git`, pull requests with `gh`, vulnerabilities with direct OSV queries. The audit found and fixed eight real problems (`docs/evaluation/results/p2-accuracy-audit.md`).

**38. What does the audit not prove?** That RIP is right on repository layouts it was not run on, that JavaScript complexity is right (no independent implementation), and that the score weights are good. It proves the measurements on three repositories.

**32. What would you do next?** Deploy and record the real limits, run the accessibility audit, add Playwright journeys, measure the graph at the caps, then decide whether the worker is needed.
