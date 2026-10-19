# Verification checklist

Resolve each item with an official source. Record the result in `verified-facts.md` or the matrix.

| ID | Item | Why it matters | Status |
|---|---|---|---|
| C-01 | Semgrep engine license and the license of the default rules registry (commercial use limits) | Optional integration only if licensing is compatible | Unverified |
| C-02 | CodeQL CLI terms of use for open-source and hosted analysis | Likely exclude from the open core | Unverified |
| C-03 | SonarQube Community Edition license, language support, branch analysis limits | Competitor comparison | Unverified |
| C-04 | OpenSSF Scorecard license, checks list, and how to run it offline | Reuse checks or integrate | Unverified |
| C-05 | OSV-Scanner license, offline database support, supported ecosystems, API rate limits | Core security integration | Unverified |
| C-06 | Gitleaks license, current maintenance, JSON output format | Core security integration | Unverified |
| C-07 | Tree-sitter and web-tree-sitter licenses, WASM grammar availability for Python | Parser decision | Unverified |
| C-08 | TypeScript compiler API stability and license | JS/TS analyzer | Unverified |
| C-09 | dependency-cruiser and Madge: license, features, benchmark candidates | Accuracy comparison baselines | Unverified |
| C-10 | import-linter and ArchUnit rule models | Inspiration for the rules DSL | Unverified |
| C-11 | jscpd license and output format versus own implementation | Duplication decision | Unverified |
| C-12 | scc and Lizard licenses, language coverage | Metrics decision | Unverified |
| C-13 | GitHub REST API: unauthenticated and authenticated rate limits, tarball endpoint behavior and size | Acquisition design | Unverified |
| C-14 | GitHub terms regarding scraping and automated access for hosted analysis | Legal risk | Unverified |
| C-15 | Managed Postgres free tiers (limits, retention, connection limits) | Hosting plan | Unverified |
| C-16 | Free worker hosting options (CPU, memory, sleep behavior, terms) | ADR 0011 | Unverified |
| C-17 | pg-boss maintenance status and Postgres requirements | Queue decision | Unverified |
| C-18 | Cytoscape.js, Sigma.js, ELK.js licenses and large-graph performance claims | ADR 0012 | Unverified |
| C-19 | Apache-2.0 compatibility of every dependency license planned for the engine | License risk | Unverified |
| C-20 | CodeScene positioning and public documentation on hotspots (for citation only) | Competitor comparison | Unverified |
