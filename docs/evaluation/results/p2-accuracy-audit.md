# Accuracy audit against independent ground truth (2026-10-25)

Goal: check what RIP reports against numbers produced by other means, not by RIP. The audited repository is `manikanta7cheruku/NEURAL-SHELL` (owner's production repository: 493 tracked files, 275 Python, 111 JavaScript, 1,539 commits).
A second pass used `manikanta7cheruku/provenance` (Python and TypeScript, src layout) and this repository. Everything below was run on 2026-10-25. Scripts were throwaway and are not part of the repository.

## Method

| Quantity | Independent source |
|---|---|
| Files, extensions, test files | `git ls-files` and a path rule written separately |
| Lines | A line counter over the tracked files (non blank lines compared with RIP code plus comment lines) |
| Python imports, cycles, complexity | Python's own `ast` module (a real parser, not RIP's text scanner), own import resolver, own Tarjan search |
| JavaScript and TypeScript imports | A separate regular expression extractor and resolver |
| Blast radius | Own reverse reachability over the independent edges |
| Commits, contributors, churn, hotspots | `git rev-list`, `git shortlog`, `git log --numstat` per file |
| Merged pull requests | `gh pr list --state merged` |
| Vulnerabilities | Direct queries to the OSV API |
| Secrets | `git grep` for common key formats |
| Workflows, README | Reading the files |

## Result summary

| Check | RIP before this audit | RIP now | Independent |
|---|---|---|---|
| Tracked files | 493 locally, 482 through the web route | **493 both ways** | 493 |
| Python files analyzed as code, test files | 274 / 27 | **275 (248 source, 27 test)** / 27 | 275 / 27 |
| Python dependency edges | 613 (precision 1.00, **recall 0.855**) | **717 of 717** | 717 |
| Python file cycles | sizes 2, 2, 2, 3, 5, 16 | **2, 2, 2, 2, 3, 4, 10, 16** | 2, 2, 2, 2, 3, 4, 10, 16 |
| JavaScript dependency edges | 224 of 224 | 224 of 224 | 224 |
| TypeScript edges (Provenance) | 153 of 153 | 153 of 153 | 153 |
| Python function complexity (top 10) | 9 of 10 equal, one differs by 1 | same | AST |
| Blast radius (6 largest, direct and total) | equal | equal | own reachability |
| Commits, contributors | 1,539 / 3 (after the previous fix) | 1,539 / 3 | 1,539 / 3 |
| Hotspot commits and churn (3 files) | equal | equal | git log |
| Merged pull requests | 17 | 17 | 17 |
| Vulnerabilities, axios 1.16.1 and 1.13.6 | 55 | 55 | 21 + 34 |
| Vulnerabilities, chromadb 1.5.8 | **8** | **4** | 8 records, 4 distinct vulnerabilities |
| Total vulnerable advisories | **162** | **158** | n/a |
| Duplicate code | 20 groups | 20 groups | the top group diffed: identical |
| Large files (3) | 1,030, 1,075, 1,119 code lines | same | 1,107, 1,153, 1,147 non blank lines (comments and docstrings removed) |
| Hosted style (archive) versus local analysis | files 482 vs 493 | **identical files, nodes, edges, cycles, lines, languages** | n/a |
| Secrets | 0 | 0 | 0 |

## Problems found and fixed

1. **Python imports of namespace packages were missed.** A directory without `__init__.py` (here `seven_utils/`) is a valid Python package, but `from seven_utils import hf_offline` was reported as an unresolved import and produced no edge. Fixed.
2. **Importing from a package did not depend on the package's `__init__.py`**, although Python runs it. 96 edges were missing, so RIP reported 6 Python file cycles where the code has 8 (cycles through `__init__.py` files were merged or invisible). Fixed: both the module and the package file are dependencies now. The Architecture score of NEURAL-SHELL moved from 58 to 54 because of the cycles that were hidden.
3. **One vulnerability was counted twice** when OSV lists it as a GHSA record and again as a PYSEC or CVE record (chromadb: 8 records, 4 vulnerabilities). Records that share an id or alias are now one advisory.
4. **README install section not recognized** ("Get Seven" followed by "Download the latest installer and run it"). Fixed by recognizing more headings and by reading what the section says. This removed a false finding.
5. **The same GitHub Action used in several places was reported once, at the last line.** Now one finding lists every line.
6. **Hosted analyses counted fewer files than the repository has** (482 instead of 493) because binary and oversized files were skipped before counting. They now count as files that were not analyzed, with the reason.
7. **A source file named like a community file was treated as documentation.** `license.py` matched the rule meant for `LICENSE` and was left out of the analysis. Community file names now count as documentation only with a document extension or none (`LICENSE`, `LICENSE.txt`, `SECURITY.md`), so `license.py` and `security.ts` are code.
8. **The score proof panel was an unreadable seven column table.** Redesigned: one block per measurement with what was measured, the points it earned of the points it could earn, a labeled scale with this repository marked on it, and the files behind it. Measurements that could not be made are listed separately and are never counted as zero.

## Findings that were checked and are correct

- Duplicate code across languages: the largest group is a Python script embedded as a string inside `electron/overlay_daemon.js` that is identical to `seven_overlay/_layout_runner.py`. It is a real duplicate.
- Fan-in and fan-out numbers equal the edge counts. Test counts, the number of architecture decision records (7) and the language line counts are consistent with the repository.
- Findings on the 700 line size limit match the files' line counts.

## Not covered by this audit

- JavaScript and TypeScript function complexity has no independent implementation here, so only Python complexity was cross-checked.
- The duplicate detector was spot checked on its largest group, not exhaustively.
- Risk index weights and score curves are provisional design choices. This audit checks the measurements they use, not whether the weights are right.
- Only three repositories were audited by hand. Accuracy on other layouts is not proven. The independent scripts are simple and would not catch errors that both they and RIP share (for example dynamic imports).
