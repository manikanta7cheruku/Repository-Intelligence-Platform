# Viva preparation: how the analysis works

Companion to `how-the-engine-reads-and-analyzes-code.md`. Answers are short on purpose: say them in your own words. Items marked (unverified) must be checked before you claim them.

## Reading files

**1. How does RepoLens read a repository?** It walks the folder in sorted order (or extracts a GitHub archive with a defensive tar reader) into a bounded Workspace. It skips dependency folders and caches, never follows symlinks, and counts every exclusion with a reason.

**2. Does it run the code it analyzes?** No. Files are only read as text. Git is run with hooks and fsmonitor disabled, and a test proves a hostile `fsmonitor` setting is not executed.

**3. What stops a malicious archive or URL?** Only `github.com` is accepted. The tar reader rejects `..` paths, absolute paths, symlinks, hard links, devices, duplicate entries, and archives over the size or file-count limits.

**4. What if a file is too large or unreadable?** It is listed as not analyzed with a reason. Totals are shown separately (total, code, production, test, analyzed) so nothing looks silently dropped.

## Understanding code

**5. How does it parse TypeScript and JavaScript?** With the real TypeScript compiler API, which builds an abstract syntax tree (AST). From the tree it extracts imports, exports, symbols and functions.

**6. How does it handle Python?** By scanning text after blanking comments and strings. It is support level 2, not a full parser, so architecture confidence is capped at medium for Python repositories and the report says so.

**7. What is an import "resolution"?** Turning `./util/hash` or `react` into a target: an internal file, a third-party package, a built-in module, or unresolved with a reason. TypeScript's module resolver runs on an in-memory copy of the repository.

**8. What is cyclomatic complexity?** 1 plus the number of decision points in a function (`if`, loops, `case`, `catch`, ternary, `&&`, `||`, `??`). It approximates how many paths need testing. The thresholds are conventions.

**9. Why is the tool allowed to fail on one language?** Analyzers are isolated plugins. If one crashes, its languages drop to detection-only, the report is marked partial, and the reason is shown. One failure never aborts the run or turns into a fake zero.

## Graph and architecture

**10. How is a circular dependency found?** Tarjan's strongly connected components algorithm, written iteratively so deep graphs cannot overflow the stack. A component with more than one file or module is a cycle.

**11. What is a module?** A directory or package that groups files. Edges between files are aggregated into module edges, which gives the architecture view and the layer levels.

**12. How are architecture rules enforced?** A YAML file defines layers (globs) and rules (`allowOnly`, `forbid cycles`, `forbid external`, `limit`). Edges are checked against them, violations carry file and line, and the CLI exits with code 1. A baseline accepts old violations and fails only on new ones.

**13. What is blast radius and how is it computed?** The set of files that could be affected by changing one file. Breadth-first search over reversed import edges gives direct and indirect dependents, longest chain, modules and entrypoints. It follows static imports only.

## Scores and recommendations without machine learning

**14. How can it recommend without ML?** Recommendations are rules over evidence: group findings by package or rule, pick the nearest fixed version from OSV, derive effort from the semantic-version jump, rank by severity times confidence. Every number is traceable to a formula.

**15. What does "Inputs used 75 percent" mean?** One quarter of a score's weighted inputs were unavailable (for example no rules file). The score is computed from what exists and says how much was missing. If too little exists the score is "not assessed", never zero.

**16. What is "points to gain"?** The most a dimension could rise if one input reached 100. It tells the user which fix helps most.

**17. Is the risk index a prediction?** No. It is a weighted mean of percentiles (complexity 0.30, dependents 0.25, change frequency 0.25, missing test linkage 0.20) that ranks where a change is costly. The weights are provisional and calibrated in Phase 3.

**18. Why do development-only vulnerabilities count 40 percent?** They are not shipped to users. The 40 percent is a provisional design choice (unverified against real data).

## History, security and pull requests

**19. What does history add?** Churn, hotspots (complex and often changed files), contributors, commit message quality. Remote repositories use a sample of the latest 300 commits from the GitHub API, without file-level churn.

**20. How are secrets handled?** A built-in scanner and optional Gitleaks look for credentials. The secret value is never written to any report or log.

**21. How does the pull request check work without running tests?** It analyzes the base ref in a temporary detached Git worktree and the head, diffs the two reports, and applies thresholds (new rule violation, new runtime cycle, new high finding, or a 3-point score drop gives "regressed"). It finds structural regressions, not behavioral bugs.

## Quality and honesty

**22. How do you know the engine is correct?** 237 automated tests pass (`pnpm check`), including real Git repositories, and 12 fixture repositories with hand-written ground truth score accuracy 1.0. Fixtures are written by the author, so they can share blind spots; real-repository benchmarks are recorded separately.

**23. Is the output reproducible?** Yes: sorted traversal, content-hash ids, stable JSON serialization, and a test that shuffles file order and checks an identical hash. The only varying fields are timestamps.

**24. Does the tool follow its own rules?** Yes. `pnpm analyze:self` analyzes this repository with `repolens.rules.yaml` and exits 0. During Phase 1.5 verification it exposed two files over the 700-line limit, which were split (`pipeline/files.ts`, `cli/help.ts`). It still flags its own largest functions (`analyze`, `computeScores`, `generateFindings`) as high complexity; refactoring them is planned work (P3-09).

**25. What are the limits?** Static analysis only; Python is level 2; dynamic imports and framework wiring are invisible to blast radius; thresholds and weights are provisional; a report with no findings does not prove a repository is safe.

**26. Why a TypeScript monorepo and a CLI first?** One engine (`packages/core`) is reused by the CLI now and by the web app and GitHub Action later, so every surface shows the same numbers.

## Why not machine learning?

**27. Why did you not use machine learning for analysis and prediction?** Five reasons, in order of weight.
(1) Explainability: every score and recommendation here traces to a formula and to evidence in the code, so a user can ask "why" and get an answer. A trained model would be a black box.
(2) No labeled data: predicting defects needs thousands of repositories with known bug history. We do not have that dataset, and inventing one would break the project rule of never inventing metrics.
(3) Determinism: the same repository must give the same report, which a test enforces. Models can drift between versions.
(4) Safety and privacy: the engine reads code only as text and never sends it anywhere. Hosted models would send private code to a third party.
(5) The facts do not need it: imports, cycles, complexity, dependents and vulnerable versions are exact computations. Machine learning is useful where the answer is uncertain, not where it can be computed.

**28. Is machine learning ever appropriate here?** Yes, as a later, optional layer: calibrating risk weights against real defect history, or ranking recommendations by what maintainers actually fix. That needs the calibration data planned for Phase 3, and it would be added as an opt-in, clearly labeled estimate, never replacing the deterministic facts. This is future work, not a claim about the current tool.

**29. Does that make the tool "not intelligent"?** It is rule-based expert analysis: the knowledge is encoded in graph algorithms, thresholds and scoring formulas. The honest label is "static analysis with explainable heuristics", which is what the report states.
