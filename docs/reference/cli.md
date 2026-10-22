# CLI reference

Build once with `pnpm build`, then run `node packages/cli/dist/index.js` (shortcut: `pnpm repolens`).
After publishing the package the command is `repolens`.

```text
repolens analyze <path|github-url> [options]
repolens report <report.json> [--format markdown|html] [--out <file>]
repolens diff <before.json> <after.json> [--format markdown|json]
repolens schema
repolens --version | --help
```

## analyze options

| Option | Meaning |
|---|---|
| `-f, --format <list>` | `json`, `markdown`, `html`. Comma separated or repeated. Default `json,markdown` |
| `-o, --out <dir>` | Output directory, default `./repolens-report` |
| `--stdout` | Print the JSON report to stdout. The summary goes to stderr |
| `--ref <ref>` | Branch, tag or commit for GitHub targets |
| `--rules <file>` | Rules file. Default: `repolens.rules.yaml`, `.yml` or `.json` in the analyzed directory |
| `--baseline <file>` | JSON `{ "accepted": [finding ids] }`. Matching findings are suppressed |
| `--write-baseline <file>` | Write all current finding ids as a baseline and exit 0 |
| `--config <file>` | Configuration file (JSON or YAML subset). Default: `repolens.config.json` or `.yaml` in the analyzed directory |
| `--exclude <glob>` | Exclude paths, repeatable |
| `--offline` | No network access. Vulnerability lookups become "not assessed" |
| `--no-history` | Skip Git history |
| `--with-history` | For GitHub targets, also make a shallow hardened clone for history |
| `--no-tests` | Do not analyze test files |
| `--fail-on <severity>` | Exit 1 when a finding at or above `critical`, `high`, `medium` or `low` exists |
| `--fail-on-partial` | Exit 4 when the report is partial |
| `-q, --quiet` | Print only errors |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Policy failure: a rule violation, or a finding at or above `--fail-on` |
| 2 | Usage or configuration error (bad flag, invalid rules file, invalid config, non-GitHub URL) |
| 3 | Analysis or acquisition error (path missing, download failed, internal error) |
| 4 | Report is partial and `--fail-on-partial` was given |

Rule violations always cause exit 1 (they are policy you wrote). Other findings only affect the exit code when `--fail-on` is used.

## Configuration file

```yaml
exclude: ["generated/**", "**/*.snap"]
includeTests: true
moduleDepth: 1            # directory levels below the source base that form a module
complexity:
  moderate: 10
  high: 20
  veryHigh: 50
duplication:
  enabled: true
  minLines: 8
  minChars: 120
history:
  enabled: true
  maxCommits: 1000
  authors: names          # or anonymous
  hotspotLimit: 15
security:
  offline: false
  osv: true
  secrets: true
  workflows: true
  gitleaksPath: null
budgets:
  maxFiles: 20000
  maxFileBytes: 5242880
  analysisTimeoutMs: 120000
```

Unknown keys are errors, so typos never silently do nothing. The resolved configuration hash is stored in every report.

## Environment

`GITHUB_TOKEN` (optional): raises GitHub rate limits for archive downloads. It is sent only to GitHub hosts, never forwarded across hosts, never logged, never stored.

## Recipes

```bash
# CI gate: architecture rules only
repolens analyze . --offline -q

# Adopt on legacy code
repolens analyze . --offline --write-baseline repolens.baseline.json
repolens analyze . --offline -q --baseline repolens.baseline.json

# Everything as HTML plus fail on high severity
repolens analyze . -f html -o report --fail-on high
```
