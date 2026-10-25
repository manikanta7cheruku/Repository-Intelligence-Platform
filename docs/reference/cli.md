# CLI reference

Build once with `pnpm build`, then run `node packages/cli/dist/index.js` (shortcut: `pnpm repolens`).
After publishing the package the command is `repolens`.

```text
repolens analyze <path|github-url> [options]
repolens report <report.json> [--format markdown|html] [--out <file>]
repolens diff <before.json> <after.json> [--format markdown|json]
repolens impact <report.json> <file> [--format markdown|json]
repolens graph <report.json> [--format mermaid|dot|svg] [--module <path>] [--out <file>]
repolens pr [path] --base <ref> [--head <ref>] [--online] [--fail-on-regression] [--format markdown|json] [--out <file>]
repolens pr --base-report <a.json> --head-report <b.json> [--changed <list.txt>]
repolens trend [path] [--ref <ref>] [--points 6] [--format markdown|json] [--out <file>]
repolens glossary [term] [--format markdown|json]
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
| `--coverage <file>` | Coverage report to ingest: `lcov.info`, `coverage-summary.json` (Istanbul) or Cobertura XML. Reports named like these are also found automatically in the repository |
| `--no-activity` | For GitHub targets, do not call the GitHub API for commits, pull requests and releases |
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

## Phase 1.5 commands

### impact: what could break if a file changes

```bash
repolens impact repolens-report/report.json src/core/util.ts
```
Prints direct dependents, all dependents (direct and indirect, and how many through runtime imports), longest chain, modules affected, entrypoints affected and the files that import it directly.
Static imports only. Use `--format json` for machine output. If the file is not in the dependency graph the error suggests close matches.

### graph: diagrams you can paste or download

`mermaid` (flowchart text for any Mermaid renderer), `dot` (Graphviz), `svg` (self-contained, light and dark aware, accessible title and description). `--module <path>` prints a file-level Mermaid drill-down
of one module and its neighbors.

### pr: did this change make the architecture worse

```bash
repolens pr --base main                          # base branch versus your working tree
repolens pr --base main --head feature --fail-on-regression
repolens pr --base-report base.json --head-report head.json --changed changed-files.txt
```
Analyzes the base and the head in the same way (same configuration, same rules file from your checkout, offline unless `--online`), then prints a pull-request-ready Markdown comment: verdict (regressed, improved,
unchanged) with reasons, new rule violations, new circular dependencies, new findings, complexity increases, new third-party packages, and the blast radius of the changed files.
Git refs are checked out in temporary detached worktrees that are removed afterwards. Your working tree is not modified. `--fail-on-regression` exits with 1 when the verdict is regressed.
In CI make sure the base branch exists locally (`actions/checkout` with `fetch-depth: 0`).

### trend: how the repository changed over time

```bash
repolens trend --points 8
```
Analyzes evenly spaced commits on the first-parent history (2 to 15 points) and prints size, modules, edges, cycles, third-party packages and scores per commit, trend lines, drift between the first and last sample and
plain-language insights. Structure only (offline, no secret or vulnerability checks per snapshot).

### glossary: what every term means

`repolens glossary` lists all terms, `repolens glossary file-cycle-ratio` shows one with the five answers (plain meaning, technical meaning, why it matters, how it is calculated, how to improve it).
`--format json` is what the web app consumes.

## Remote analysis and history

For a GitHub URL (online, no `--no-activity`) the CLI also reads commit, pull request and release signals from the GitHub API (a sample of the 300 most recent commits and 100 most recent closed pull requests).
This gives contributors, commit message quality, merge counts and release cadence but no file-level churn. For hotspots and the risk index's change-frequency factor analyze a local clone or use `--with-history`.
