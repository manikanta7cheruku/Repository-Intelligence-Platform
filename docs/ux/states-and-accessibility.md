# States, responsive behavior, and accessibility

## State catalog (every page defines all of these)

| State | Rule |
|---|---|
| Loading | Skeleton of the final layout, no spinner-only screens, announce to assistive tech |
| Empty | Say what is missing, why, and what to do next |
| Error | Plain reason, stage, retry action, and what data is still available |
| Partial | Banner with exactly what is missing and the effect on confidence |
| Not assessed | Neutral style, reason text, never zero, never a green or red color |
| Low confidence | Visible label and tooltip explaining the cause |
| Success | Quiet confirmation, no celebration |

## Responsive behavior

| Width | Behavior |
|---|---|
| 1024 and up | Left rail plus content, detail panels docked on the right |
| 640 to 1023 | Rail collapses to icons, detail panels become drawers |
| Under 640 | Bottom or hamburger navigation, tables become stacked rows, graph shows module list first with graph as opt-in |

## Accessibility requirements (WCAG 2.2 AA)

1. Semantic landmarks, one h1 per page, logical heading order.
2. Every interactive element reachable and operable by keyboard, visible focus ring.
3. Graph has a table alternative with the same data and actions, and a keyboard navigable tree.
4. Color is never the only carrier of meaning. Severity always has a text label.
5. Forms have labels, error messages tied with `aria-describedby`, and error summaries.
6. Live regions announce job progress changes politely.
7. Reduced motion respected. Zoom to 200 percent and reflow at 320 px work.
8. Skip link, command palette is keyboard accessible and escapable.
9. Contrast checked automatically on all token pairs in light and dark.

## UX acceptance criteria

- [ ] The overview answers the five questions without scrolling past the first two screens on a 1440 px display.
- [ ] A first-time user reaches the architecture explorer from the landing page in under 2 minutes (usability test).
- [ ] No page shows missing data as zero.
- [ ] Every finding shows evidence, location, confidence, limitations.
- [ ] All core flows complete with the keyboard only.
- [ ] Axe reports no critical or serious issues, Lighthouse accessibility 95 or higher.
- [ ] No em dashes in any UI copy.
