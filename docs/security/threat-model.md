# Threat model

Method: STRIDE over trust boundaries. Every analyzed repository is untrusted input.

## Trust boundaries

1. Internet to web app and API (untrusted users).
2. Web app to database (trusted, but inputs validated).
3. Worker to external sources (GitHub, OSV) (untrusted responses).
4. Worker to repository content (untrusted files, archives, Git data).
5. Report data to the browser (untrusted content rendered to users).
6. CLI to local filesystem (user's own machine, untrusted repository inside it).

## Assets

User trust in report correctness, GitHub tokens, database contents, worker compute, other users' reports, the project's reputation.

## Threats and mitigations

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| T-01 | Malicious archive: path traversal, absolute paths | Custom extractor normalizes and rejects any path escaping the workspace | P1-04 tests |
| T-02 | Symlink or hardlink escape, device files | Reject links and special files in archives | P1-04 tests |
| T-03 | Decompression bomb, huge file count | Compressed and expanded size caps, ratio cap, file count cap, per-file cap, time cap | P3-02 tests |
| T-04 | SSRF through the submitted URL, redirects, DNS rebinding | Accept only allow-listed GitHub hosts in the MVP, parse URLs strictly, resolve and block private and link-local ranges, limit redirects to allow-listed hosts | P3-02 tests |
| T-05 | Git hooks and arbitrary command execution | Never run hooks, set hooks path to an empty directory, no submodules, no filters or textconv, no credential helpers, restricted protocols | P3-01 tests |
| T-06 | Running package scripts or builds | The engine never installs dependencies or runs repository code in the MVP | Code review, tests that assert no child process uses repository content as a command |
| T-07 | Parser crash or hang on hostile input | Per-file size and time limits, per-analyzer isolation, worker process restarts | P3-02 tests |
| T-08 | Resource exhaustion of the worker | Concurrency caps, job budgets, memory guard, queue quotas per IP | P3-03 tests |
| T-09 | Secrets in reports, logs, or caches | Redact secrets in findings and logs, store hashes and locations, never store matched values in full | P1-11 tests |
| T-10 | GitHub token leakage | Tokens only from environment, never logged, never stored in reports, fine-grained read-only scope, CLI warns on broad scopes | P3-01 review |
| T-11 | Cross-user data access and cache poisoning | Unguessable report ids, no private data on the hosted site, cache keys include commit SHA and config hash, user scoping added with accounts | P3-01 tests |
| T-12 | XSS through report content (file names, messages, snippets) | Reports are data rendered through escaped components, exported HTML escapes everything and ships with a strict CSP meta tag, no raw HTML injection | P2 tests, P3-01 |
| T-13 | API abuse and denial of service | Rate limiting per IP and per job type, request size caps, input validation, job quotas | P3-03 |
| T-14 | Supply chain compromise of dependencies or CI | Lockfile, Dependabot, dependency review, pinned action versions by SHA in Phase 3, minimal CI permissions, SBOM | P3-11 |
| T-15 | Malicious external tool output (Gitleaks, OSV) | Parse with schema validation, treat as untrusted | P1-11 tests |
| T-16 | Data retention and deletion failures | Retention job, deletion endpoint by report token, documented policy | P3-03 |
| T-17 | Misleading output (false sense of security) | No "secure" verdicts, classification and limitations on every finding, coverage on every score | UX acceptance |
| T-18 | Prompt injection style content in repository docs | Not applicable: no LLM in the pipeline. If optional models are added later, they get their own threat model | n/a |

## Residual risks

- Parser zero-day vulnerabilities: mitigated by isolation and limits, not eliminated. The hosted worker runs in a container without secrets beyond job needs.
- Free hosting limits protection options such as network egress filtering. Documented per deployment.

## Data leaving the user's environment

| Mode | Data sent | To whom |
|---|---|---|
| CLI offline | None | n/a |
| CLI online | Package names and versions for vulnerability lookups; repository URL and ref for remote fetch | OSV.dev, GitHub |
| Hosted | Submitted repository URL, resulting report | Our database and worker |
