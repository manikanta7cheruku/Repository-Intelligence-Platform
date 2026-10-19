# Competitor and building block matrix

Every cell is Unverified until the research session fills it with a source and date.
The "Initial view" column is a hypothesis from training knowledge, not a finding.

| Tool | Official repository or site | License | Maintenance | Languages | Architecture | Quality | Security | Git history | Custom rules | CLI and CI | Deployment | Initial view (hypothesis) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CodeQL | Unverified | Unverified | Unverified | Unverified | Limited | Some | Strong | No | Yes (queries) | Yes | Local CLI, GitHub | Integrate optionally if license allows, do not embed |
| Semgrep | Unverified | Unverified | Unverified | Unverified | No | Some | Strong | No | Yes | Yes | Local, cloud | Optional integration |
| SonarQube Community | Unverified | Unverified | Unverified | Unverified | Limited | Strong | Some | Limited | Limited | Yes | Self-hosted server | Compare, do not embed |
| OpenSSF Scorecard | Unverified | Unverified | Unverified | n/a | No | No | Practices | Some | No | Yes | CLI, Action | Integrate or mirror checks |
| Tree-sitter | Unverified | Unverified | Unverified | Many grammars | Parser only | Parser only | Parser only | No | No | Library | Library | Build on it |
| OSV-Scanner | Unverified | Unverified | Unverified | Ecosystems | No | No | Dependencies | No | No | Yes | CLI | Integrate |
| Gitleaks | Unverified | Unverified | Unverified | n/a | No | No | Secrets | Yes (history) | Yes | Yes | CLI | Integrate |
| dependency-cruiser | Unverified | Unverified | Unverified | JS and TS | Rules and graph | No | No | No | Yes | Yes | CLI | Benchmark against, study rules |
| Madge | Unverified | Unverified | Unverified | JS and TS | Graph, cycles | No | No | No | No | Yes | CLI | Benchmark against |
| import-linter | Unverified | Unverified | Unverified | Python | Contracts | No | No | No | Yes | Yes | CLI | Study contract model |
| ArchUnit | Unverified | Unverified | Unverified | Java | Rules | No | No | No | Yes (code) | Test lib | Library | Study rule design |
| CodeScene | Unverified | Commercial (to verify) | Unverified | Many | Behavioral | Some | No | Strong | Limited | Yes | SaaS, on-prem | Closest concept, cite only |
| Sourcegraph | Unverified | Unverified | Unverified | Many | Navigation | No | No | Some | Search | Yes | Self-hosted, SaaS | UX reference for code navigation |
| scc and Lizard | Unverified | Unverified | Unverified | Many | No | Metrics | No | No | No | Yes | CLI | Integrate or reimplement |
| jscpd | Unverified | Unverified | Unverified | Many | No | Duplication | No | No | No | Yes | CLI | Integrate or reimplement |
| GitHub repo analytics tools | Unverified | Unverified | Unverified | n/a | No | No | No | Activity | No | Varies | SaaS | Survey for portfolio phase |

## Build, integrate, reuse, exclude (initial, to confirm after research)

| Decision | Items |
|---|---|
| Build | IR, JS/TS and Python import analysis glue, graph algorithms, rules engine, scoring, report generation, architecture explorer, templates for explanations |
| Integrate (subprocess or library) | OSV, Gitleaks, Tree-sitter, TypeScript compiler API |
| Reuse ideas only | dependency-cruiser rules, import-linter contracts, ArchUnit predicates, CodeScene hotspot concept |
| Optional later | Semgrep, Scorecard, Trivy and Syft |
| Exclude from the open core | CodeQL (license), SonarQube (server product), any hosted-only service |

## Differentiation hypotheses (not claims)

- H1: Evidence and coverage on every conclusion, including explicit Not assessed states.
- H2: One engine for learning a codebase and enforcing architecture, in a CLI and a web UI.
- H3: Architecture explorer that separates observed, inferred, and documented information.
- H4: Fully open, no paid service, deterministic explanations.

Each hypothesis must be tested against the verified matrix before it is stated publicly.
