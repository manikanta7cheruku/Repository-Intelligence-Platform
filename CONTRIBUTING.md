# Contributing

Thanks for your interest. The project is in early development and is currently maintained by one person.

## Setup

```bash
corepack enable
pnpm install
pnpm check
```

Node 22 or newer is required.

## Workflow

1. Open or pick an issue. Every change maps to a backlog item.
2. Create a branch: `feat/short-name`, `fix/short-name`, `docs/short-name`.
3. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).
4. Run `pnpm check` and make sure it passes.
5. Open a pull request using the template. Link the issue.

## Standards

- Findings must carry an ID, severity, confidence, evidence, and limitations.
- New analyzers must declare their support level and ship fixtures with expected results.
- No em dashes in docs or UI copy.
- Do not add dependencies without checking their license against `docs/adr/0010-license-apache-2.md`.

## Reporting security issues

See `SECURITY.md`. Do not open public issues for vulnerabilities.
