# Phase 1 benchmark on public repositories (P1-18): to be completed by the owner

Run these on your machine after `pnpm build`. Choose five repositories of different sizes and styles
(small library, medium application, monorepo, Python project, project with a documented architecture).
Check each repository's size on GitHub first. Record the table that the script prints.

```bash
GITHUB_TOKEN=<optional read-only token> node scripts/benchmark.mjs \
  https://github.com/<owner>/<repo1> https://github.com/<owner>/<repo2> ... \
  --runs 3 --write docs/evaluation/results/benchmarks.md
```

Then add under the table: machine (CPU, RAM, OS), the commit SHAs (the script records the short SHA from the
archive), and three observations per repository from reading its report (one finding that was correct, one that
was wrong or doubtful, one thing the report missed). Those manual notes are the qualitative evaluation.

Suggested candidates (verify size and license before running, these are suggestions not claims): a small
TypeScript library, `expressjs/express`, a mid-size TypeScript application, a Python package such as `psf/requests`,
and a pnpm monorepo.
