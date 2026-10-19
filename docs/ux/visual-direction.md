# Visual direction

Goal: a calm, dense, evidence-first developer product. It should feel like a tool engineers trust
with serious work, not a marketing template.

## Reference qualities (study, do not copy)

| Quality | Learn from | What to take |
|---|---|---|
| Dense but calm lists and tables | GitHub, Linear | Row density, subtle separators, clear hover and focus |
| Data-first monitoring screens | Sentry, Grafana | Severity semantics, filters as first-class, time context |
| Code navigation | Sourcegraph | Evidence links to file and line, side panels |
| Graph tooling | Established dependency graph viewers | Grouping, collapse, search, legend |
| Documentation clarity | Stripe docs | Typography, hierarchy, plain language |

## Principles

1. Clarity over decoration. Every pixel must answer a question.
2. Information hierarchy: page title, summary strip, primary content, secondary panels.
3. Density: compact rows (32 to 36 px), tight but consistent spacing on a 4 px base.
4. Evidence everywhere: every finding links to location, rule, and limitation.
5. Honest states: Not assessed, Partial, Low confidence are first-class visuals.
6. Restraint: one accent color, neutral surfaces, semantic colors only for severity and status.

## Explicit avoid list

Gradients and glows, glassmorphism, giant rounded metric cards, emoji icons, decorative illustrations,
fake activity or testimonials, charts without a question, bounce animations, copy with hype words, em dashes.

## Typography

- UI: a neutral sans (Inter or system UI stack as fallback), 14 px base, 13 px dense tables.
- Code and identifiers: a monospace (JetBrains Mono or system monospace), 13 px.
- Scale: 12, 13, 14, 16, 20, 24, 30. Line heights 1.4 for UI, 1.6 for prose.
- Weights: 400, 500, 600. No light weights.

## Themes

Light and dark from the same tokens. Respect `prefers-color-scheme` and offer a manual toggle.

## Motion

120 to 180 ms ease-out for hover, focus, and panel transitions. Respect `prefers-reduced-motion`.
No decorative animation. Progress uses real stage data.

## Iconography

One consistent line icon set (Lucide is permissively licensed, verify) at 16 px and 20 px. Icons always paired with text for status.
