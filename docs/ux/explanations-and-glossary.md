# UX requirement: explain every technical term (Phase 2)

Every technical label in the web app must be explainable in place, so a first-time user never meets a word like "file-cycle-ratio" without help.

## Source of truth

`@repolens/core` exports `GLOSSARY` (and `explain(id)`, `DIMENSION_LABELS`). Report inputs, dimensions and many terms use glossary ids directly: the `name` of every score input is a glossary id.
The report records `methodology.glossaryVersion`. The web app must not duplicate or reword glossary text.

## Entry structure (five answers)

| Field | Shown as |
|---|---|
| `plain` | First line of the tooltip. One sentence a non-expert understands |
| `technical` | "Technically" line for experts |
| `why` | "Why it matters" |
| `calculation` | "How it is calculated" with the formula in words |
| `improve` | "How to improve" with concrete actions |

## Behavior

1. Hover or keyboard focus on a term shows a popover with plain meaning and a "More" action that opens the full entry (side panel on desktop, bottom sheet on mobile). Touch: tap the term.
2. Terms are marked with a subtle dotted underline and an accessible name. The popover is dismissible with Escape, does not trap focus, and respects reduced motion.
3. Every score card or row has an "Explain this score" action showing inputs used, points to gain per input and the improve text, in the order of largest gain first.
4. A searchable Glossary page lists all entries grouped by category (dimensions, score inputs, concepts, findings, metrics, statuses) with deep links per term (`/glossary#file-cycle-ratio`).
5. "Not assessed" always shows the reason and what would enable it, using the report's reason text.
6. Severity, confidence, origin and classification chips are glossary terms too.
7. Text is plain text (no HTML). Escape anything that comes from a repository.

## Acceptance

- Every label in every view that exists in the glossary is explained in place (automated check: list all labels rendered, assert each has an entry).
- A usability test participant can explain at least 80 percent of the terms after reading only the hover text.
- Popovers meet WCAG 2.2 AA (contrast, focus, hover and focus persistence, Escape).
