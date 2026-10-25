/** Text printed by `repolens --help`. */
export const helpText = (version: string): string =>
  `RepoLens ${version}: explainable repository analysis

Usage:
  repolens analyze <path|github-url> [options]
  repolens report <report.json> [--format markdown|html] [--out <file>]
  repolens diff <before.json> <after.json> [--format markdown|json]
  repolens impact <report.json> <file> [--format markdown|json]
  repolens graph <report.json> [--format mermaid|dot|svg] [--module <path>] [--out <file>]
  repolens pr [path] --base <ref> [--head <ref>] [--online] [--fail-on-regression] [--format markdown|json]
  repolens pr --base-report <a.json> --head-report <b.json> [--changed <list.txt>]
  repolens trend [path] [--ref <ref>] [--points 6] [--format markdown|json]
  repolens glossary [term] [--format markdown|json]
  repolens schema
  repolens --version | --help

Analyze options:
  -f, --format <list>      json, markdown, html (comma separated or repeated). Default: json,markdown
  -o, --out <dir>          Output directory. Default: ./repolens-report
      --stdout             Print the JSON report to stdout (summary goes to stderr)
      --ref <ref>          Branch, tag or commit for GitHub targets
      --rules <file>       Architecture rules file (default: repolens.rules.yaml in the target)
      --baseline <file>    Accepted finding ids (JSON). Matching findings are suppressed
      --write-baseline <f> Write all current finding ids as a new baseline and exit 0
      --config <file>      Configuration file (JSON or simple YAML)
      --exclude <glob>     Exclude paths (repeatable)
      --offline            No network access (vulnerability lookups become "not assessed")
      --no-history         Skip Git history analysis
      --with-history       For GitHub targets, also clone shallowly for history (needs git)
      --coverage <file>    Coverage report to ingest (lcov.info, coverage-summary.json or Cobertura XML)
      --no-activity        For GitHub targets, do not call the GitHub API for commit, pull request and release signals
      --no-tests           Do not analyze test files
      --fail-on <severity> Exit 1 when any finding is at or above critical|high|medium|low
      --fail-on-partial    Exit 4 when the report is partial
  -q, --quiet              Print nothing except errors
  -h, --help               Show help

Exit codes: 0 ok, 1 policy failure, 2 usage or configuration error, 3 analysis error, 4 partial result (with --fail-on-partial).
The GitHub token, if needed, is read from GITHUB_TOKEN and is never written to reports or logs.
`;
