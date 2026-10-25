# DOTEST: what you must test after merging Phase 1.5

Do these in order. Each step says what you should see. Anything different is a bug or a gap: copy the exact command and output into the
"resume Phase 1.5" prompt in `docs/phases/phase-1-5-insight-upgrade.md`. Everything here was verified by 238 automated tests in a sandbox, but
the items marked **LIVE** need real network, real tools or your real repositories, which the sandbox did not have.

Use a scratch folder for outputs, for example `~/rl-out`. The commands assume you are in the RepoLens repository and ran `pnpm build`.
Shortcut used below: `rl` means `node packages/cli/dist/index.js` (or `pnpm repolens`).

## 1. Install and automated checks

```bash
corepack enable
pnpm install
pnpm format
pnpm check
```

Expected: lint, build, typecheck and tests pass. The test summary should show **238 tests passed** (Vitest counts the same tests). If Biome reports
lint errors that were not there in Phase 1, paste them. Then:

```bash
pnpm --filter @repolens/core run eval        # fixture accuracy, expect exit code 0 and all 1.000
pnpm analyze:self                            # RepoLens analyzes itself with its own rules, expect exit code 0
```

## 2. Re-run your Provenance repository (the before and after test) **LIVE**

```bash
rl analyze https://github.com/manikanta7cheruku/provenance -f html,markdown,json -o ~/rl-out/prov-remote
```

Compare with the report you posted before. You should now see:

| Check | Expected now |
|---|---|
| Files line | Roughly "182 files in total: 92 code files (80 production, 12 test), 91 analyzed" (derived from your earlier report, small differences are fine) and no longer "91 of 182" |
| Executive summary at the top | A headline naming Python and TypeScript, strengths and concerns, three next steps |
| Recommendations | Grouped per package, for example "Upgrade vite to ... (fixes N advisories, development tool only, major update)", not "Upgrade 11 vulnerable dependencies" |
| Fixed versions | Only versions for the affected package, one nearest version in each recommendation |
| Vulnerability wording | Each finding starts with the package and plain summary, advisory ids and CVE aliases are in the text |
| Dev tools | vite and esbuild marked development-only (if your lockfile marks them dev) and counted at 40 percent |
| Security hygiene score | Higher than 53 (roughly 60 to 65 if vite and esbuild are dev-only). Check the "Points to gain" column |
| README finding | "README has no install or setup section" is gone, your "Run it locally" heading is detected |
| Architecture | Score still high, confidence **medium** (Python is support level 2), "Inputs used 75%" because no rules file |
| Testing and CI label | Reads "Testing and CI", and "Test coverage not ingested" line appears |
| Maintenance activity | Now assessed from the GitHub API sample (confidence medium), with commit message quality, merged pull request count and releases. If you see "rate limit", set `GITHUB_TOKEN` and rerun |
| Shell script coverage | "n/a (detection only)", not 0 percent |
| Function names | `<anonymous>` replaced by names such as `useCallback() callback` |
| Risk and blast radius sections | Present, with files and reasons |
| HTML | Hover any dimension or input name: a tooltip explains it. A Glossary section and an SVG module map exist |

Open `~/rl-out/prov-remote/report.html` in a browser, use light and dark mode, tab through with the keyboard, and print preview it.

**Doubt to check yourself:** some advisories were titled "launch-editor" but attached to vite. In the new report each finding says whether OSV lists other
affected packages. Open two of them on osv.dev and confirm the version match is right. Tell me what you find.

## 3. Local clone of Provenance (history, risk with churn) **LIVE**

```bash
git clone https://github.com/manikanta7cheruku/provenance ~/provenance && cd ~/provenance
rl analyze . --offline -f markdown,html -o ~/rl-out/prov-local
```

Expected: history is available (source Git), hotspots appear, the risk table now includes a "frequently changed" driver for some files, the maintenance
activity score is assessed with high or medium confidence, commit message quality is shown.

## 4. Blast radius **LIVE**

```bash
rl impact ~/rl-out/prov-local/report.json apps/web/src/lib/api.ts
```

(use any file from the "Blast radius" table). Expected: direct dependents, all dependents, modules affected, entrypoints affected. Verify two of the direct
dependents by searching the code for imports of that file (`grep -rn "lib/api" apps/web/src`).

## 5. Diagrams **LIVE**

```bash
rl graph ~/rl-out/prov-local/report.json -f svg -o ~/rl-out/graph.svg     # open in a browser
rl graph ~/rl-out/prov-local/report.json -f mermaid                        # paste into https://mermaid.live to check it renders
rl graph ~/rl-out/prov-local/report.json -f dot -o ~/rl-out/graph.dot      # if Graphviz is installed: dot -Tpng graph.dot -o graph.png
rl graph ~/rl-out/prov-local/report.json --module apps/web/src/features    # file level drill-down
```

Expected: readable diagrams, modules in columns by dependency level, red outline for cycles (none expected in Provenance).

## 6. Architecture rules **LIVE**

Create `repolens.rules.yaml` in the Provenance clone (adjust paths if your layout differs):

```yaml
version: 1
layers:
  - name: domain
    paths: ["packages/domain/**"]
  - name: persistence
    paths: ["packages/persistence/**"]
  - name: config
    paths: ["packages/config/**"]
  - name: api
    paths: ["apps/api/**"]
rules:
  - id: domain-is-pure
    description: Domain must not depend on persistence, config or the API
    severity: high
    allowOnly:
      from: domain
      to: []
  - id: no-module-cycles
    forbid: cycles
    scope: modules
```

Run `rl analyze . --offline -q -o ~/rl-out/rules; echo $?`. Expected: the "Inputs used" for Architecture rises to 100 percent. Exit code 0 if the domain package
is clean, or 1 with violations listed (then check one by hand). To prove enforcement: add `from pv_persistence import x` to a domain file (Python imports count), rerun,
expect exit code 1 and a violation with the line number, then undo the change.

## 7. Pull request guardian **LIVE**

In the Provenance clone:

```bash
git switch -c rl-test
# make a change that adds a cross-layer import or a large function in any file under packages/domain
rl pr --base main
rl pr --base main --fail-on-regression; echo $?
git switch main && git branch -D rl-test
```

Expected: a Markdown verdict (regressed, improved or unchanged) with reasons, new findings, new edges, blast radius of the changed files. With a violating change the
exit code is 1. With a harmless change (a comment) the verdict is "unchanged". Also run `rl pr --base main --head HEAD` after committing, and
`rl pr --base-report a.json --head-report b.json` with two saved reports.

## 8. Trend over history **LIVE**

```bash
rl trend --points 6
```

Expected: a table of 6 commits with code lines, modules, edges, cycles, third-party packages and scores, trend lines, and a drift summary. It leaves your working tree
untouched (`git status` clean, `git worktree list` shows one entry). It can take a minute on large repositories.

## 9. Coverage ingestion **LIVE**

Produce a coverage report with your own test tools, for example:

```bash
cd ~/provenance/apps/web && npx vitest run --coverage      # needs @vitest/coverage-v8; writes coverage/lcov.info
cd ~/provenance && uv run pytest --cov --cov-report=xml    # writes coverage.xml
rl analyze . --offline --coverage apps/web/coverage/lcov.info -o ~/rl-out/cov -q
```

Expected: "Test coverage" appears in Practices and in the Testing and CI score ("Test coverage" input available), and the risk table's test linkage uses measured
percentages. If you do not have coverage tooling, create a small `lcov.info` by hand (see `packages/core/src/metrics/coverage.test.ts` for the format) and verify the
file path matching.

## 10. Secrets and Gitleaks **LIVE**

Install Gitleaks (https://github.com/gitleaks/gitleaks releases). In a throwaway folder create `a.txt` containing a fake AWS key formatted as `AKIA` followed by 16 capital
letters or digits, then run `rl analyze <folder> --offline`. Expected: both the built-in scan and Gitleaks report, the value never appears in the report files
(`grep` for it), and Security hygiene reflects it. Delete the folder afterwards.

## 11. Online and rate limit behavior **LIVE**

- Run the remote analysis twice in a row without `GITHUB_TOKEN`. If the second run says rate limit for history, that is the designed message. Set a fine-grained read-only token
  and repeat. Never paste the token into an issue or report.
- `rl analyze <url> --no-activity` must skip history calls, `--offline` must make no network calls.

## 12. Platform checks (if you use Windows)

Run section 1 and section 3 on Windows. Report any path separator or line ending problem. The apply script and `pnpm` commands should work in Git Bash or PowerShell.

## 13. Security and abuse spot checks

- `rl pr --base "--upload-pack=x"` must be refused (a usage error or "Invalid ref").
- `rl analyze https://github.com.evil.com/a/b` must refuse (not github.com).
- Open `report.html` and confirm there is no network request in the browser dev tools network tab (everything is inline).
- Confirm `git status` is clean after `rl pr` and `rl trend`.

## 14. What to send me when something fails

1. The command, 2. the full output (remove tokens), 3. your OS and Node version (`node -v`), 4. the report JSON if it is about wrong content (remove anything private).
Use the "resume Phase 1.5" prompt, which tells the assistant exactly what to read.

## 15. Done criteria for Phase 1.5

All of sections 1 to 8 behave as described, section 9 and 10 verified at least once, any discrepancy fixed or recorded in `docs/PROJECT_STATE.md` as a known gap, and the
results of sections 2 and 3 saved in `docs/evaluation/results/p15-provenance.md` (before and after table, plus anything surprising).
