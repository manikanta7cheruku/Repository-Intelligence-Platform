# Design tokens (v0)

Implemented as CSS custom properties in Phase 2 (P2-02). Values are starting points to be checked
for contrast with automated tools.

## Color roles (light)

| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | #FFFFFF | Page background |
| `--bg-subtle` | #F6F7F9 | Panels, table headers |
| `--bg-muted` | #ECEEF2 | Hover, selected |
| `--border-default` | #D5D9E0 | Dividers |
| `--text-primary` | #14171F | Body |
| `--text-secondary` | #4A5160 | Secondary text |
| `--text-muted` | #6A7282 | Hints (check contrast on subtle backgrounds) |
| `--accent` | #2457C5 | Links, primary actions, focus ring base |
| `--accent-strong` | #1B429A | Hover on accent |
| `--sev-critical` | #B3261E | Critical |
| `--sev-high` | #C4501B | High |
| `--sev-medium` | #A86F00 | Medium |
| `--sev-low` | #2F6B9A | Low |
| `--sev-info` | #5A6272 | Info |
| `--state-ok` | #1F7A4D | Pass |
| `--state-na` | #6A7282 | Not assessed |

## Color roles (dark)

| Token | Value |
|---|---|
| `--bg-canvas` | #0F1218 |
| `--bg-subtle` | #151A22 |
| `--bg-muted` | #1D2430 |
| `--border-default` | #2A3240 |
| `--text-primary` | #E6E9EF |
| `--text-secondary` | #B4BBC8 |
| `--text-muted` | #8F98A8 |
| `--accent` | #7AA2FF |
| `--accent-strong` | #9DBAFF |
| `--sev-critical` | #FF7B72 |
| `--sev-high` | #F0883E |
| `--sev-medium` | #D9A441 |
| `--sev-low` | #6CB0E8 |
| `--sev-info` | #98A2B3 |
| `--state-ok` | #4CC38A |
| `--state-na` | #8F98A8 |

Rule: severity is conveyed by text label and icon plus color. All text pairs must meet WCAG AA (4.5:1), large text 3:1, UI components 3:1.

## Spacing, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Radius: 4 (inputs, buttons), 6 (panels). No pill shapes except tags.
- Elevation: borders instead of shadows. One shadow level for popovers only.
- Focus ring: 2 px accent outline with 2 px offset, always visible.

## Layout

- App shell: left navigation 240 px (collapsible to 56 px), top bar 48 px, content max width 1440 px.
- Breakpoints: 640, 1024, 1440.
- Tables: row height 32 px dense, 40 px comfortable (user setting).
