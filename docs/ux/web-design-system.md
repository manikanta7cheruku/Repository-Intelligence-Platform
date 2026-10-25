# Web design system (Phase 2)

Source of truth in code: `apps/web/src/app/globals.css` (tokens and components) and `apps/web/src/lib/svg.ts` (chart palette and export). This file explains the decisions.

## Direction: monochrome precision

White and black with grayscale tonal gradients. Color is reserved for meaning (severity, status, links to evidence). There is no brand accent color: the accent is black in the light theme and white in the dark theme.
No glow, glass, 3D shapes, stock illustrations, emoji, fake charts or fake numbers. One consistent line icon set (16 px grid, 1.4 stroke) in `components/icons.tsx`, always next to a text label.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | #0A0A0B | page |
| `--surface` | #F4F4F5 | #141417 | quiet panels, hover |
| `--text` | #0A0A0B | #FAFAFA | body, strong marks |
| `--muted` | #52525B | #A1A1AA | secondary text |
| `--line` | #8A8A94 | #71717A | borders of controls (3:1 or more) |
| `--hair` | #E4E4E7 | #27272A | decorative dividers |
| `--danger` | #B42318 | #F97066 | critical, high, cycles |
| `--warning` | #B54708 | #F79009 | medium |
| `--success` | #067647 | #47CD89 | complete, good |
| `--info` | #175CD3 | #84ADFF | low, incoming edges, focus |

Contrast ratios against the page background were computed with the WCAG formula: text 19.8 and 19.0, muted 7.7 and 7.7, control borders 3.4 and 4.1, danger 6.6 and 7.1, warning 5.4 and 8.4, success 5.7 and 9.8, info 6.0 and 8.9 (light and dark).
They must be rechecked in the finished interface with axe, which has not been run yet.

Page gradients are grayscale only (`--bg-grad`, from surface to background) and sit behind the top 520 px of marketing pages. Reports have a flat background.

## Typography

Geist (sans) and Geist Mono, loaded through `next/font` (self-hosted at build time, no runtime request). Scale: 12, 13, 14, 15 (body), 16 to 18 (lede), 21 to 26 (section), 26 to 36 (page title), 34 to 60 (display, landing only).
Tabular numerals (`.num`) for every metric. Paths and identifiers use the mono face.

## Layout

- Marketing pages: sticky header, 1180 px column, footer.
- Report: left rail (232 px, sections), top bar (repository, search, theme), content (1120 px max), bottom reliability strip (status, code analyzed, not assessed, schema), right evidence drawer.
- Below 880 px: no rail. Bottom tab bar (Briefing, Structure, Impact, Risk, More), More opens a sheet with the other sections, the drawer becomes a bottom sheet (88 percent height), tables become stacked cards with secondary columns hidden, the map is the same interactive canvas with touch pan and pinch zoom.
- Touch targets are at least 44 px on the tab bar and sheet items. Controls inside dense tables are 30 to 36 px (known gap against the 44 px goal, to review on a real phone).

## Components

Button (primary, default, quiet, small, large), icon button, input, check, segmented control, filter chip, chip, severity badge (word plus shape: diamond critical, triangle high, square medium, circle low, ring info), bar, stat strip, card, data table (sortable, paged, stacked on phones),
term popover, evidence drawer, command palette, export menu, graph canvas with zoom tools and legend, chart set, score row with proof panel, not assessed block, empty state, skeleton.

## Interaction rules

- Hover is used for exactly three things: explaining a glossary term (after 220 ms), highlighting the neighborhood of a graph node, and row emphasis in tables. Every hover also works on focus and tap.
- Motion is 120 to 240 ms, ease-out, opacity and transform only. `prefers-reduced-motion` and the Settings switch remove all transitions.
- Focus is a 2 px ring in the info color with 2 px offset on every interactive element.
- Selection opens one evidence drawer for findings, files, modules and terms. Escape closes it.
- Keyboard: Ctrl or Cmd K opens search, Tab moves through graph nodes, arrow keys move between neighbors, Enter opens, Escape closes.

## States

Loading uses skeletons shaped like the page. Empty states say what the empty result means. Not assessed always shows its reason and, where known, what would enable it, in a dashed neutral block, never as a red zero.
Errors name what failed and what to do next. Partial reports show "Partial analysis" in the reliability strip.

## Charts and exports

Charts are SVG built from one class based stylesheet (`chartCss`). On screen the palette is CSS variables (follows the theme). Exports serialize the same markup with the light literal palette, add a title, repository, commit, date, tool version and legend, and a footer
stating that the output is static analysis and not a security audit. File names: `rip-<repository>-<view>-<yyyy-mm-dd>.<ext>`.
