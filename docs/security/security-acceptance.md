# Security acceptance criteria

All must pass or have a written, accepted exception before v0.1.0.

| ID | Criterion | Test |
|---|---|---|
| SA-01 | No code from an analyzed repository is executed (no child process arguments derive from repository content) | Static test plus review |
| SA-02 | Malicious archive fixtures (traversal, symlink, bomb, huge file count) are rejected within budget | Automated tests |
| SA-03 | URL validation blocks non-GitHub hosts, private IPs, link-local, loopback, credentials in URLs, unsafe redirects | Automated tests |
| SA-04 | Git operations run with hooks disabled, no submodules, no credential helpers | Automated test with a repository containing a hostile hook |
| SA-05 | Secrets never appear unredacted in logs, reports, or caches | Tests with seeded secrets |
| SA-06 | Report rendering is XSS safe for hostile file names, messages, and snippets | Playwright test with hostile fixture |
| SA-07 | Exported HTML is self-contained, escaped, and carries a CSP | Automated check |
| SA-08 | Rate limits and job quotas enforced, tested | Automated tests |
| SA-09 | Resource budgets (time, memory, size) terminate runaway jobs and produce partial results | Tests with large fixtures |
| SA-10 | Dependencies have no known high or critical vulnerabilities at release | OSV scan in CI |
| SA-11 | No secrets in repository history | Gitleaks on the repo |
| SA-12 | Security headers set on the web app (CSP, frame ancestors, referrer policy, content type options) | Automated check |
| SA-13 | Retention and deletion implemented and documented on a privacy page | Manual and automated |
| SA-14 | Security policy and private reporting enabled | Manual |
| SA-15 | Findings never claim a repository is secure | Review of templates |

## Reliability acceptance

| ID | Criterion |
|---|---|
| RA-01 | Any single analyzer failure yields a partial report, not a failed job |
| RA-02 | Cancelling a job stops work within 10 seconds and cleans the workspace |
| RA-03 | Worker restart recovers queued jobs and marks interrupted jobs failed with a reason |
| RA-04 | Health endpoint and structured logs exist for web and worker |
| RA-05 | Database migrations have documented rollback steps |
