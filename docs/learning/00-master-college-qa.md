# Master college question bank (cross-cutting)

Answers are written to be accurate for this project. Where a claim depends on facts not yet verified (for example
competitor details), the answer says so. Saying "I verified X and did not verify Y" is stronger than overclaiming.

## A. The problem and the product

**1. What problem does RepoLens solve?**
Understanding and governing a codebase. Learners need to see structure fast. Maintainers need to keep architecture
from eroding. Existing tools each cover a slice (security scanning, quality dashboards, dependency graphs) and
usually give numbers without saying what they did not look at. RepoLens produces one report where every conclusion
carries evidence, confidence and limitations.

**2. Who are the users?**
Learners (students, new contributors), maintainers and small teams, and reviewers or instructors. See docs/product/PRD.md.

**3. Why is this a major project and not a script?**
It combines compilers (parsing, module resolution), graph algorithms (strongly connected components), software
metrics, secure handling of untrusted input, a plugin architecture, a versioned data contract, scoring methodology,
a CLI and (Phase 2) a web app, with a scientific evaluation on ground-truth fixtures.

**4. What is the output of the tool?**
A report in JSON (versioned schema), Markdown or HTML: scores per dimension with coverage and confidence, a dependency
graph with modules and cycles, metrics, findings with ids and evidence, recommendations, security signals, practices,
Git history, limitations and reproducibility metadata.

## B. Novelty, gaps and moat (answer honestly)

**5. What is new here? Do not say "nothing like it exists".**
We do not claim uniqueness. Tools such as SonarQube, CodeQL, Semgrep, OpenSSF Scorecard, dependency-cruiser, import-linter,
ArchUnit and CodeScene each solve part of the problem (their details are still marked Unverified in docs/research until
the research session is done). Our contribution is the combination and the discipline: one engine for learning and
enforcing architecture, honest coverage and confidence everywhere, "not assessed" instead of fake zeros, deterministic
explanations, and a measured evaluation. These are differentiation hypotheses, not proven advantages.

**6. What gap are you filling?**
(1) Honest partial analysis: most tools silently skip what they cannot analyze. We report the support level per
language and mark scores not assessed. (2) Architecture understanding for learners plus rules for maintainers in one
tool. (3) Fully open, no paid service, runs offline.

**7. What is your moat?**
Honest answer: a software moat is weak for an open-source project. What can compound over time is: the quality and
breadth of language analyzers contributed by a community, a library of reusable architecture rule sets, a calibrated
scoring methodology backed by public evaluation data, and trust built by transparent methodology. For the college
project the defensible point is the engineering rigor (fixtures, ground truth, tests, security design), not exclusivity.

**8. What are the limitations and gaps of your work?**
No call graphs, no data-flow or taint analysis, JS/TS at Level 3 and Python only at Level 2, no coverage ingestion, scores
are provisional and not calibrated on large samples, import resolution cannot see generated files or framework
conventions, history is limited by shallow clones and squash merges, the hosted site analyzes public repositories only,
and accuracy numbers come from small author-built fixtures. All of this is stated in the report limitations.

**9. Why not just use SonarQube or CodeQL?**
They are strong at what they do. SonarQube is a server product, CodeQL's license limits some uses and it focuses on security
queries (verify both in docs/research). Neither is a lightweight offline CLI that explains architecture to a newcomer.
We integrate scanners where they are best (OSV, Gitleaks) instead of competing with them.

**10. Is it a "dashboard"?**
No. The report is evidence first: every number links to inputs, and the UI (Phase 2) is designed around answering five
questions, not showing tiles.

## C. Technology choices

**11. Why TypeScript and Node.js?**
One language for engine, CLI, web and worker, so one data model and fewer integration bugs for a solo developer.
TypeScript's compiler API gives accurate JS/TS module resolution for free. Node 22 is a current LTS line with built-in
`fetch`, `parseArgs` and a stable test ecosystem. Trade-off: heavy CPU work in Node is slower than native code. We measured
a 195k line input in about 3 seconds in a sandbox, which is adequate for the target.

**12. Why pnpm? Why a monorepo?**
pnpm gives fast, disk efficient installs, strict dependency isolation (a package cannot import something it did not declare),
a lockfile for reproducibility and first-class workspaces. A monorepo lets `core`, `cli`, `web` and `worker` share code and
change atomically with one CI. Alternatives: npm workspaces (works, less strict, slower), yarn (fine), Turborepo/Nx (added
later if build times need caching).

**13. Why Biome and Vitest?**
Biome combines lint and format in one fast tool, so fewer config files. Vitest is fast, TypeScript native and Jest compatible.
Both are easy to run in CI. Alternatives: ESLint plus Prettier plus Jest (more setup).

**14. Why Apache-2.0?**
Permissive like MIT but with an explicit patent grant and clear contributor terms. It is compatible with MIT, BSD, ISC
and Apache dependencies. Copyleft (AGPL, GPL) was rejected to keep adoption easy. (ADR 0010.)

**15. Why no machine learning or LLM?**
The core tasks (graphs, metrics, rules) have deterministic, explainable, reproducible algorithms. ML needs labeled data
we do not have, adds cost and non-determinism, and would make results harder to trust. Explanations are templates over
structured evidence. Optional local models could be explored later, never as a requirement. (ADR 0007.)

**16. Why is analysis not done in Vercel serverless functions?**
Verified limits for the free tier: functions run at most 300 seconds, 2 GB memory, 4.5 MB request bodies, and the plan is
non-commercial. Cloning and parsing untrusted repositories can exceed that and should be isolated from the web tier. So
the web app (Vercel) is a viewer and API, and a separate worker runs the engine. (ADR 0002.)

**17. Why a modular monolith and not microservices?**
One deployable core with strict internal module boundaries is simpler to build, test and reason about for one developer.
Microservices add network boundaries, deployment and observability cost without a measured need. Boundaries are enforced
by architecture rules (this repository checks itself in CI), so splitting later is possible.

**18. What architecture patterns does the system use?**
Pipeline (pipes and filters) for the analysis stages, plugin (strategy) for language analyzers, dependency inversion
(analyzers depend on interfaces, the pipeline composes them), layered modules with enforced direction, ports and adapters
style for external tools (Git, Gitleaks, OSV behind narrow functions that return normalized findings), local-first
(the CLI works without any server).

**19. How do you handle security of analyzing untrusted code?**
We never execute repository code. Archives are extracted by our own safe extractor (no links, no traversal, size and count
limits). URLs are strictly validated (github.com only, no credentials, ports or IPs, redirects only to allow-listed hosts).
Git runs with hooks and fsmonitor disabled and no credential helpers. Secrets are never stored in reports. HTML reports have
no scripts and a strict CSP. See docs/security/threat-model.md.

**20. How do you know your results are correct?**
Hand-built fixtures with ground truth written from the source, measured as precision and recall (currently 1.0 on 11
fixtures, which proves the mechanisms, not real-world accuracy), plus 165 automated tests, determinism tests, and
self-analysis in CI. Real repository benchmarks are a separate, honestly labeled step.

## D. Process and ethics

**21. How was the work organized?**
Four phases with documented exit criteria, ADRs for every major decision, a decision register that separates "technically
validated" from "owner approved", and a backlog with acceptance criteria. The architecture has four workstreams: core
engine and analyzers, graphs/metrics/rules/security, web and design system, CLI/infrastructure/testing.

**22. Who did what? (answer truthfully)**
Describe contributions exactly as they happened. The four workstreams are a way to explain the architecture, and you can
explain each one in depth. Do not credit anyone with work they did not do, and do not claim work you did not do. If a
teammate contributed a part, name it. Examiners value honest, specific answers about what each part does and why.

**23. Did you use AI assistance? How do you show you understand the code?**
If you used AI assistance, say so plainly and be able to explain every module without it: the learning files, ADRs and
tests exist so you can. Be ready to change a rule threshold or add a fixture live and show the test pass. Follow your
institution's policy on tool use.

**24. What would you do next?**
Account and organization analysis, more languages (Go, Java via Tree-sitter), call graphs for one language, coverage
ingestion, license compatibility, calibration of scores on a larger public dataset, and a usability study.
