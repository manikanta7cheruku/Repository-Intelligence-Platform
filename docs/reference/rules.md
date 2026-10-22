# Architecture rules reference

Rules live in `repolens.rules.yaml` (or `.json`). The YAML subset supports maps, lists, inline lists, scalars and
comments. Anchors, tags, block scalars and flow maps are rejected with a line number.

```yaml
version: 1                       # required
layers:                          # named groups of files, matched by glob over repo-relative paths
  - name: ui
    paths: ["src/ui/**"]
  - name: domain
    paths: ["src/domain/**"]
rules:
  - id: domain-not-ui            # lowercase letters, digits, dashes
    description: Domain must not depend on UI
    severity: high               # critical, high, medium (default), low, info
    forbid:
      from: domain
      to: ui
```

A file belongs to the first layer whose globs match it. Files in no layer are not constrained by layer rules.

## Globs

`**` any depth, `*` within a segment, `?` one character, `{a,b}` alternatives. A pattern without `/` matches the file name at any depth.

## Rule types

| Type | Syntax | Violation |
|---|---|---|
| Forbid dependency | `forbid: { from: A, to: B }` | A file in layer A imports a file in layer B |
| Allow only | `allowOnly: { from: A, to: [B, C] }` | A file in layer A imports a layer other than A, B or C. `to: []` means A may import no other layer |
| Forbid external | `forbid: { from: A, external: ["react*"] }` | A file in layer A imports a matching third-party package (built-in modules are ignored) |
| No cycles | `forbid: cycles` with `scope: files` or `modules` (default modules) | A strongly connected component of that scope |
| Limit | `limit: { metric: file-code-lines or function-complexity or module-fan-out, max: N }` | A file, function or module above the limit |

## Output

Each violation is a finding with id `RL-RULE-<RULE-ID>-<hash>`, rule id `rule.<id>`, `confidence: high`, origin `observed`, graph path evidence, the import line, remediation, and the limitation that only statically resolved imports are evaluated. Ids are stable, so they work in baselines.

## Baselines

```json
{ "accepted": ["RL-RULE-DOMAIN-NOT-UI-1a2b3c4d"] }
```

Create one with `--write-baseline`. Baselined findings are suppressed and counted in `rules.baseline.suppressed`.
