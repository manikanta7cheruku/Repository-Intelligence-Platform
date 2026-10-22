# Learning: Phase 0, Foundation

## What happened in this phase

We did not write product code. We set up everything that makes later work fast and safe: the repository, tooling, CI,
documentation, decisions, threat model and UX direction, and we agreed the scope.

## What, why, where

| What | Why | Where |
|---|---|---|
| Monorepo with pnpm workspaces | One codebase for engine, CLI, web, worker with atomic changes and one CI | `pnpm-workspace.yaml`, `package.json` |
| TypeScript strict mode | Catch whole classes of bugs at compile time, and share types across packages | `tsconfig.base.json` |
| Biome, Vitest | One fast tool for lint and format, a fast TypeScript test runner | `biome.json`, `vitest.config.ts` |
| CI on every pull request | A green `main` is always releasable. Also runs dependency review | `.github/workflows` |
| Dependabot, security policy, templates | Supply-chain hygiene and contributor experience | `.github`, `SECURITY.md`, `CONTRIBUTING.md` |
| Apache-2.0 | Permissive with a patent grant | `LICENSE`, `NOTICE`, ADR 0010 |
| Product spec and PRD | Say what we build and what we do not | `docs/product` |
| ADRs | Record each major decision with alternatives and reconsideration conditions | `docs/adr` |
| Threat model | Plan for hostile repositories before writing code | `docs/security/threat-model.md` |
| UX direction and tokens | Professional, dense, accessible UI, designed before coding | `docs/ux` |
| Decision register | Distinguish "technically validated" from "owner approved" | `docs/registers` |
| Phase files with prompts | So any new chat can resume work with full context | `docs/phases` |

## Key ideas to understand

- **Architecture Decision Record (ADR):** a short document that records a decision, the alternatives, and what would make us
  change it. It prevents re-arguing decisions and explains "why" months later.
- **Trunk-based flow with short branches:** `main` always works. Work happens on small branches merged through pull requests.
- **Threat modeling (STRIDE):** list what an attacker could do at each trust boundary, then design mitigations first.
- **Verified vs unverified facts:** only vendor documentation counts as verified. We verified the Vercel limits and marked
  the rest of the competitor facts Unverified until researched.

## Decisions made

Local-first TypeScript monorepo, separate worker for hosted analysis, safe acquisition via archives, Postgres only, no LLM,
transparent scoring, integrate OSV and Gitleaks instead of building SAST, Next.js on Vercel for the web, Apache-2.0,
account-wide analysis deferred.

## College questions and answers

**1. Why spend a whole phase on documents and setup?** Setup mistakes (no CI, no decisions, no threat model) are the most
expensive to fix later. Phase 0 cost hours and saved days. It also produced the evidence of method that examiners look for.

**2. What is an ADR and show one.** See `docs/adr/0002-local-first-and-worker.md`: context (Vercel limits), alternatives
(all serverless, local-first plus worker, one VPS), decision, consequences, and conditions for reconsideration.

**3. Why mark ADRs "Proposed" first?** Technical validation and owner approval are different. A good idea is not a decision
until the owner accepts it, and an accepted decision may still be unvalidated.

**4. How did you decide the architecture?** We listed three options, checked verified platform limits, and chose the one with the
least infrastructure that meets the requirements (modular monolith, local-first, thin web tier plus worker).

**5. What are the risks you identified first?** Scope for a solo developer, import resolution accuracy, hosting limits, untrusted
input security, graph readability in the UI, and scores that look authoritative without a method.

**6. How do you make sure scope does not explode?** An MVP boundary in the spec, a cut list ordered by what to drop first, and
rules that new ideas go to the "Later" backlog.

**7. Why is the CI file so strict (frozen lockfile, minimal permissions)?** Reproducible installs and least privilege reduce
supply-chain risk. CI only gets read access to the repository.

**8. Why Vercel for the web and not for analysis?** Verified limits (300 s, 2 GB, 4.5 MB bodies, non-commercial). Analysis of
untrusted repositories needs more time and isolation, so it runs in a worker.

**9. What did you verify and what not?** Verified: Vercel Hobby limits (300 s duration, 2 GB memory, body size via a secondary
source). Not verified yet: competitor licenses and capabilities, free tier details for databases and worker hosts.

**10. Why Apache-2.0 and not MIT?** Patent grant and clearer contribution terms. MIT would also work. The cost is slightly more
paperwork (NOTICE file).

**11. What is a threat model good for?** It turns "be secure" into a checklist of concrete attacks (path traversal, SSRF, decompression
bombs, hooks, secret leakage, XSS in reports) with a mitigation and a test for each. Phase 1 implemented the engine-side mitigations.

**12. What does "local-first" mean here?** The CLI works fully offline on your machine. The hosted site is optional and built on the
same engine. Private code never needs to leave the machine.

**13. How does the documentation help after the project?** The ADRs, spec, evaluation plan and learning files become the basis of
the college report, and the prompts let work continue in new sessions.

**14. What would make you change the architecture?** Each ADR lists reconsideration conditions, for example if Node cannot meet the
performance target we would move hot paths to native code behind the same interface.
