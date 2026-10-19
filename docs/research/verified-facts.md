# Verified facts

Only facts with a source and access date belong here. Everything else is in the verification checklist.

| ID | Fact | Source | Accessed | Status |
|---|---|---|---|---|
| V-01 | Vercel Functions on Hobby: maximum duration 300 seconds | vercel.com/docs/functions/limitations (page last updated 2026-07-01) | 2026-10-19 | Verified |
| V-02 | Vercel Functions on Hobby: maximum memory 2 GB | same | 2026-10-19 | Verified |
| V-03 | Vercel Functions request and response body limit 4.5 MB | scalar.com hosting comparison citing the Vercel limits page (secondary source) | 2026-10-19 | Verified via secondary source, confirm on vercel.com/docs/functions/limitations |
| V-04 | Vercel Hobby plan is for personal, non-commercial use | vercel.com pricing page | 2026-10-19 | Verified |
| V-05 | Hobby includes 100,000 function invocations per month | vercel.com pricing page (older snapshot), re-check current value | 2026-10-19 | Verify before relying on it |

## Consequence for the architecture

A function limited to 300 seconds, 2 GB, and 4.5 MB bodies is fine for the UI and a thin API but is
not a safe place to clone, parse, and analyze arbitrary repositories. This supports ADR 0002 and
ADR 0011: a separate worker runs analysis, and Vercel serves the UI and API only.
