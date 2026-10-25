# Learning: Phase 1.5, the insight upgrade

Phase 1 produced correct facts. Phase 1.5 turned facts into decisions. This file explains what changed, why, where it lives, how each algorithm works, what went wrong, the limits,
and a question bank. Read `phase-1-engine-cli.md` first.

## 1. Why this phase exists

We ran the tool on a real project (Provenance). The facts were right, but a reader would still be confused: "91 of 182 files analyzed" sounded like half was skipped, "11 vulnerable dependencies"
was really 3 packages, terms had no meaning, nothing said what to do first. A product has to explain itself. That is a different job from analyzing, and it needed its own phase.

## 2. What, why, where

| What | Why | Where |
|---|---|---|
| Glossary with five answers per term | Users must understand every label. One source of truth for CLI, HTML and the future web app | `packages/core/src/glossary/glossary.ts` |
| Executive summary | Readers decide in seconds whether to dig deeper | `report/summary.ts` |
| Inputs used and points to gain per score input | A score is only useful if you know what to change to raise it | `scoring/score.ts`, `report/common.ts` |
| Vulnerabilities grouped per package, nearest fix, update size, dev-only discount | One action per package is how people actually upgrade. Dev tools should not dominate | `security/osv.ts`, `scoring/recommend.ts`, `util/semver.ts` |
| README section detection | Our install detection produced a false positive | `practices/detect.ts` |
| Coverage ingestion | Test files existing is a weak proxy. Measured coverage is real evidence | `metrics/coverage.ts` |
| Commit quality, PR and release signals | Habits show how a project is run. A GitHub API sample works without a clone | `git/quality.ts`, `git/activity.ts` |
| Blast radius | Shows how far a change can ripple | `graph/impact.ts` |
| Risk index | One metric misleads, a blend of signals ranks where changes are costly | `risk/risk.ts` |
| Pull request guardian | Turns a diff into a decision: better, same or worse | `pr/guardian.ts`, `git/worktree.ts` |
| Trend | Shows drift: is architecture getting worse over time | `trend/trend.ts` |
| Diagram exports | Visual understanding and downloads | `report/diagram.ts` |
| Schema 0.2.0 | New fields need a new versioned contract | `ir/types.ts`, `ir/schema.ts`, ADR 0017 |

## 3. How the new algorithms work

### Nearest fixed version
Advisories list many fixed versions across branches (for example 1.1.0, 6.4.4, 7.3.7). Only versions that belong to the affected package are used. From those we pick the smallest version above the
installed one, preferring the same major version. The jump (patch, minor, major) sets the effort hint: patch low, minor medium, major high. See `nearestFix` in `util/semver.ts`.

### Why dev-only advisories count 40 percent
A vulnerability in a development server tool (like a bundler's dev server) matters when you run it, but it is not shipped to users. npm lockfiles mark such packages `dev: true`. We still report them,
but they affect the score less. The report says so in the finding text, so the choice is visible.

### Points to gain
For an input with normalized score `s` (0 to 100) and weight `w`, among available weight `W`, the dimension could rise by `(100 - s) x w / W` if the input reached 100. Sorting inputs by this number tells you
exactly which fix gives the biggest improvement.

### Confidence capped by language support level
A Python import graph is read lexically (level 2), so conclusions are weaker than for TypeScript (level 3). Architecture coverage is `min(analyzed share, import resolution ratio, level factor)` where the level
factor weights each language by code lines (level 3 counts 1.0, level 2 counts 0.75). The score stays, the confidence says how much to trust it.

### Blast radius
Reverse reachability: starting at a file, follow "imported by" edges breadth first. The number of files reached is the transitive dependents. The depth is the longest shortest-path. We also record the modules those files
belong to, the entrypoints among them, and how many are reached through runtime (non type-only) imports. Complexity is linear in nodes plus edges per file.

### Risk index
For each production file take the available factors, each from 0 to 1: complexity percentile, dependents percentile, change-frequency percentile (needs Git), and test linkage (0 when a test imports it, 0.5 when only
reached indirectly from tests, 1 when no test reaches it, or 1 minus measured line coverage). Percentile means the share of files strictly below, so ties at zero stay at zero. The risk is the weighted mean
with weights 0.30, 0.25, 0.25, 0.20 renormalized over the available factors. At least two factors are needed. Confidence is high with four factors, medium with three, low with two.
It is a ranking, not a prediction. The "drivers" text lists which factors are high so the ranking is explainable.

### Pull request guardian
Analyze the base and the head with the same configuration and rules. Compare findings by stable id, cycles by their member lists, edges by file paths, packages by name, and scores by dimension. The verdict is rule based: regressed if a new
rule violation, a new runtime cycle, a new critical or high finding, or a drop of 3 or more points in architecture, maintainability or security hygiene; improved if there is no regression and more findings were resolved than added, a cycle was removed
or a score rose 3 or more points; otherwise unchanged. The comment lists reasons and the blast radius of the changed files. Git refs are checked out in temporary detached worktrees (hardened git flags, validated refs) and removed afterwards.

### Trend
Take the first-parent commit list, pick up to 15 evenly spaced commits including the first and last, analyze each in a worktree (offline, structure only), and compare. Insights are templates over the numbers: size change, dependencies per file
(are files becoming more interconnected), cycle and package changes, score movement.

### Coverage ingestion
Parsers for LCOV (`SF`, `LF`, `LH`, `DA`), the Istanbul `coverage-summary.json`, and Cobertura XML. Paths in reports are absolute or relative to some package, so they are matched to repository files by the longest path suffix, refusing ambiguous matches.

### Commit quality
Pattern checks on commit subjects: Conventional Commits share, descriptive share (15 or more characters and not generic), generic share (fix, update, wip and similar). Merge commits are excluded. It describes habits, never code quality.

## 4. "How can it predict and recommend without machine learning?" (the answer to give)

The tool is a deterministic expert system, not a statistical model. Parsers extract facts (imports, functions, files). Graph algorithms compute structure (cycles, dependents). Formulas turn facts into numbers (complexity, duplication, percentiles).
Rules turn numbers into findings with evidence. Templates turn findings into explanations and ranked recommendations. The risk index is a transparent weighted formula, not a prediction of bugs: it ranks where change is costly using signals
that research has often linked to defects (complexity, change frequency, dependency centrality, weak tests). Verify specific citations before using them in your report. The same input always gives the same output, every number can be traced to
its inputs, and nothing needs training data. Machine learning would help if we had labeled data to learn from, so it is listed as future work with a rule: it may only be added if it beats the deterministic baseline in a measured evaluation.

## 5. What went wrong or was learned in this phase

1. **A lookup used the wrong key.** The test-linkage logic stored file ids but looked up paths, so indirectly tested files were reported as untested. Running the tool on its own repository and reading the explanation text exposed it. Lesson: read generated explanations critically.
2. **Order of results.** A test assumed the vulnerability list order, but packages are sorted. Lesson: do not rely on incidental order in tests.
3. **Thresholds are decisions.** The confidence for a GitHub sample (0.6) maps to "medium". I first wrote a test expecting "low". The boundary is a design choice, documented.
4. **Explaining is harder than computing.** Most of the effort went into wording, grouping and what to show first.
5. **Mixed-language limits.** Cross-language calls (a web client calling an API) are invisible to import graphs. The report now states this.
6. **Self-analysis shows our own debt.** The tool ranks our own large functions (for example the pipeline, scoring and findings generators) as the riskiest files. That is honest. Refactoring them is planned.

## 6. Known gaps

- Risk weights and PR verdict thresholds are provisional and not yet calibrated on real data (Phase 3).
- No call graph, so blast radius misses calls that are not imports.
- Remote history is a sample without file-level churn.
- Trend skips security checks per snapshot.
- Commit and PR signals describe habits only.
- The glossary is English only.
- The pull request check is a CLI today. The GitHub Action is Phase 3.

## 7. Glossary additions (short)

Blast radius, risk index, centrality, churn, weight coverage (inputs used), commit quality, pull request signals, executive summary, PR verdict. Full text: `repolens glossary`.

## 8. College questions and answers (Phase 1.5)

**1. Why add a phase between Phase 1 and the web app?** A real report revealed that correct facts were not yet useful. Fixing explanation, grouping and wording in the engine means the web app can stay thin and consistent.

**2. How does the tool decide what to fix first?** Recommendations group findings by rule or package, then rank by severity weight times confidence weight plus a small term for count. Security items for development-only tools are halved. Effort comes from the update size for packages.

**3. What is "points to gain"?** The most a dimension score could rise if one input reached 100: `(100 - input score) x weight / available weight`. It tells you the best fix.

**4. What is a risk index and is it a prediction?** A blend of complexity, dependents, change frequency and test linkage ranking where changes are costly. It is not a prediction of bugs.

**5. How do you compute blast radius?** Breadth-first search over reversed import edges from the file. Count, depth, modules and entrypoints reached are reported.

**6. Why separate runtime and type-only reach?** Type-only imports vanish at runtime, so a change to a type can break compilation but not behavior.

**7. How can a pull request check work without running tests?** It compares two static analyses. It detects structural regressions (rule violations, cycles, new findings, score drops), not behavioral bugs.

**8. How do you keep Git operations safe?** Refs are validated, git runs with hooks and fsmonitor disabled and no credential helper, worktrees are detached and temporary, and cleaned up in a finally block. A test checks the working tree is untouched.

**9. What does the verdict "regressed" require?** A new rule violation, a new runtime cycle, a new critical or high finding, or a 3-point drop in architecture, maintainability or security hygiene.

**10. Why 3 points?** A provisional threshold above typical noise on small changes. Phase 3 calibrates it on real pull requests.

**11. What is trend analysis good for?** Seeing drift: more edges per file, more cycles, more third-party packages, falling scores. It shows direction, not cause.

**12. Why evenly spaced commits?** Analyzing every commit is too slow. Even spacing gives a faithful shape of change with bounded time.

**13. How is test coverage used?** If a coverage report is found or supplied, the Testing and CI score gets a measured input and the risk index uses real per-file coverage instead of the test-link proxy.

**14. Why is commit message quality a signal, not a score?** It says nothing about code. It describes habits that make history useful. It appears as information and as an info-level finding only when many messages are generic.

**15. How does remote history work without cloning?** The GitHub REST API returns recent commits, closed pull requests and releases. We compute contributors, cadence, commit quality, merge time and release count from that sample and say it is a sample.

**16. What are the limits of the API approach?** Rate limits (a token helps), only recent commits, no per-file churn, squash merges hide authorship.

**17. Why one glossary for every renderer?** Consistency and one place to review wording. The report records the glossary version.

**18. How does the executive summary avoid inventing facts?** It is templates over counts and names that exist in the report. Tests check the summary content on fixtures with known answers and that no em dashes appear.

**19. How do you handle a technology you cannot analyze?** It is Level 1 (detection only). The report says so, shows "n/a (detection only)" for coverage, and does not give conclusions about it.

**20. Why is architecture confidence "medium" for a mixed Python and TypeScript repository?** The Python graph is lexical (level 2), so the architecture conclusion is less certain. The coverage factor is weighted by code lines, so a repository that is mostly Python gets lower confidence than one that is mostly TypeScript.

**21. What did you learn from running the tool on its own source?** It exposed a lookup bug (ids vs paths) and showed our own large functions as risky. Self-analysis is a cheap, honest test.

**22. How is the risk index different from SonarQube-style ratings?** It is transparent (weights and factors shown), combines change frequency and dependents with complexity, and states confidence. (Verify competitor details in docs/research before stating differences in writing.)

**23. What would you improve next?** Calibrate weights and verdict thresholds on real repositories, add call graphs for one language, ship the GitHub Action, and refactor our largest functions.

**24. How would you prove the risk index is useful?** Take repositories with known bug-fix history, label files that later had fixes, and measure whether high-risk files are fixed more often than others, compared with a baseline of "most complex file". Report the result honestly, including failure.

**25. Does the tool ever execute the analyzed project?** No. All checks read files. The pull request guardian checks out refs into temporary worktrees only to read them.
