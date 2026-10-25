"use client";

import type { Finding } from "@repolens/core/browser";
import { useMemo, useRef } from "react";
import { ComplexityBar, HotspotScatter, LanguageBar, useChartExport } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { FactorBars } from "@/components/drawer";
import { ExportMenu } from "@/components/export-menu";
import { FindingsList } from "@/components/findings";
import { useReport } from "@/components/report-context";
import {
  Bar,
  Card,
  Chip,
  ConfidenceChip,
  Empty,
  NotAssessed,
  PageHead,
  Stat,
  Term,
} from "@/components/ui";
import { dec, num, pct } from "@/lib/format";

/* ---------- Priorities ---------- */
export function Priorities() {
  const { report, select } = useReport();
  return (
    <>
      <PageHead
        title="Priorities"
        lede="What to fix first, ranked by severity, confidence and how many findings point at the same cause. Effort comes from the size of the change, not a guess about your team."
      />
      {report.recommendations.length === 0 ? (
        <Empty title="Nothing to prioritize">
          The checks that ran did not produce actionable recommendations.
        </Empty>
      ) : (
        <ol className="rec-list">
          {report.recommendations.map((r) => (
            <li key={r.rank} className="rec">
              <div className="rec-rank num">{r.rank}</div>
              <div className="rec-body">
                <h2 className="h4">{r.title}</h2>
                <p>{r.rationale}</p>
                <div className="rec-foot">
                  {r.effort ? <Chip tone="muted">Effort {r.effort}</Chip> : null}
                  <span className="small muted num">Priority score {dec(r.priority, 1)}</span>
                  {r.findingIds.length > 0 ? (
                    <button
                      type="button"
                      className="textlink"
                      onClick={() => select({ kind: "finding", id: r.findingIds[0] as string })}
                    >
                      See the evidence ({r.findingIds.length})
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/* ---------- Risk ---------- */
export function Risk() {
  const { report, select } = useReport();
  const ref = useRef<SVGSVGElement>(null);
  const hot = useMemo(
    () =>
      report.history.hotspots
        .filter((h) => h.complexity !== null)
        .map((h) => ({
          path: h.path,
          commits: h.commits,
          complexity: h.complexity as number,
          churn: h.churn,
          hot: (h.score ?? 0) >= 50,
        })),
    [report],
  );
  const exp = useChartExport(
    ref,
    report,
    "hotspots",
    "Hotspots: complexity against change frequency",
    640,
    320,
    ["Each dot is a file", "Dot size: lines changed", "Red dot: hotspot score of 50 or more"],
  );
  return (
    <>
      <PageHead
        title="Risk"
        lede={
          <>
            The <Term id="risk-index">risk index</Term> ranks files by how costly a change could be.
            It blends complexity, how many files depend on a file, how often it changes and whether
            tests reach it. It ranks, it does not predict bugs.
          </>
        }
      />
      <Card title="Riskiest files">
        {report.risk.assessed ? (
          <>
            <p className="small muted">{report.risk.method}</p>
            <DataTable
              caption="Files ranked by risk"
              rows={report.risk.files}
              rowKey={(f) => f.path}
              onRow={(f) => select({ kind: "risk", path: f.path })}
              initialSort={{ key: "risk", dir: "desc" }}
              columns={[
                {
                  key: "path",
                  label: "File",
                  render: (f) => <span className="mono">{f.path}</span>,
                  sort: (f) => f.path,
                },
                {
                  key: "risk",
                  label: "Risk",
                  render: (f) => (
                    <span className="risk-cell">
                      <span className="num">{Math.round(f.risk)}</span>
                      <Bar value={f.risk} label={`Risk ${Math.round(f.risk)} of 100`} />
                    </span>
                  ),
                  sort: (f) => f.risk,
                },
                {
                  key: "conf",
                  label: "Confidence",
                  secondary: true,
                  render: (f) => <ConfidenceChip value={f.confidence} />,
                },
                {
                  key: "why",
                  label: "Main reasons",
                  secondary: true,
                  render: (f) => <span className="small">{f.drivers.slice(0, 2).join("; ")}</span>,
                },
              ]}
            />
          </>
        ) : (
          <NotAssessed
            reason={report.risk.reason}
            hint="Needs at least 5 analyzed production files."
          />
        )}
      </Card>
      <Card
        title="Hotspots: complex files that change often"
        aside={hot.length > 0 ? <ExportMenu source={exp} /> : null}
      >
        {hot.length > 0 ? (
          <HotspotScatter
            points={hot}
            svgRef={ref}
            onOpen={(p) => select({ kind: "file", path: p })}
          />
        ) : (
          <NotAssessed
            reason={
              report.history.available
                ? "No hotspot has complexity data."
                : (report.history.reason ?? "Git history is not available.")
            }
            hint="Analyze a local checkout to get file level change history."
          />
        )}
      </Card>
    </>
  );
}

/* ---------- Quality ---------- */
export function Quality() {
  const { report, select } = useReport();
  const dist = report.metrics.complexityDistribution;
  const distRef = useRef<SVGSVGElement>(null);
  const langRef = useRef<SVGSVGElement>(null);
  const distExp = useChartExport(distRef, report, "complexity", "Functions by complexity", 640, 74);
  const langExp = useChartExport(
    langRef,
    report,
    "languages",
    "Code lines by language",
    640,
    34 + report.scope.languages.length * 20,
  );
  const items = report.findings.filter((f) => f.category === "quality");
  const dup = report.metrics.duplication;
  return (
    <>
      <PageHead
        title="Quality"
        lede="Size, complexity and duplication. These are signals about how hard the code is to change, not about whether it works."
      />
      <div className="grid-stats">
        <Stat
          label="Code lines"
          value={num(report.metrics.totals.codeLines)}
          note={`${num(report.metrics.totals.commentLines)} comment lines`}
        />
        <Stat label="Functions" value={num(report.metrics.functionCount)} />
        <Stat
          label={<Term id="duplication-ratio">Duplication</Term>}
          value={dup.assessed ? pct(dup.ratio, 1) : "n/a"}
          note={
            dup.assessed
              ? `${num(dup.duplicatedLines)} of ${num(dup.totalLines)} lines`
              : (dup.reason ?? "")
          }
        />
        <Stat
          label="Largest file"
          value={num(Math.max(0, ...report.metrics.files.map((f) => f.codeLines)))}
          note="code lines"
        />
      </div>
      <Card
        title={<Term id="cyclomatic-complexity">Function complexity</Term>}
        aside={dist ? <ExportMenu source={distExp} /> : null}
      >
        {dist ? (
          <ComplexityBar dist={dist} svgRef={distRef} />
        ) : (
          <NotAssessed reason="Fewer than 10 measured functions or no analyzer for the language." />
        )}
      </Card>
      <Card title="Most complex functions">
        <DataTable
          caption="Functions with the highest complexity"
          rows={report.metrics.topFunctions}
          rowKey={(f) => `${f.path}:${f.line}:${f.name}`}
          onRow={(f) => select({ kind: "file", path: f.path })}
          columns={[
            {
              key: "name",
              label: "Function",
              render: (f) => <span className="mono">{f.name}</span>,
              sort: (f) => f.name,
            },
            {
              key: "c",
              label: "Complexity",
              align: "right",
              render: (f) => <span className="num">{f.complexity}</span>,
              sort: (f) => f.complexity,
            },
            {
              key: "p",
              label: "Location",
              secondary: true,
              render: (f) => (
                <span className="mono small">
                  {f.path}:{f.line}
                </span>
              ),
            },
          ]}
          initialSort={{ key: "c", dir: "desc" }}
        />
      </Card>
      <Card title="Languages" aside={<ExportMenu source={langExp} />}>
        <LanguageBar languages={report.scope.languages} svgRef={langRef} />
      </Card>
      <Card title="Duplication">
        {dup.assessed ? (
          dup.groups.length === 0 ? (
            <Empty title="No duplicated blocks found" />
          ) : (
            <ul className="plain-list">
              {dup.groups.slice(0, 8).map((g) => (
                <li key={g.occurrences.map((o) => `${o.path}:${o.startLine}`).join("|")}>
                  <b className="num">{g.lines} lines</b> repeated in {g.occurrences.length} places:{" "}
                  <span className="mono small">
                    {g.occurrences.map((o) => `${o.path}:${o.startLine}`).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <NotAssessed reason={dup.reason} />
        )}
      </Card>
      <Card title="Quality findings">
        <FindingsList items={items} />
      </Card>
    </>
  );
}

/* ---------- Security ---------- */
export function Security() {
  const { report, select } = useReport();
  const sec = report.security;
  const osv = report.findings.filter((f) => f.ruleId === "security.osv");
  const other = report.findings.filter(
    (f) => f.category === "security" && f.ruleId !== "security.osv",
  );
  const byPkg = useMemo(() => {
    const m = new Map<string, Finding[]>();
    for (const f of osv) {
      const pkg = f.tags.find((t) => t.startsWith("package:"))?.slice(8) ?? "unknown";
      (m.get(pkg) ?? m.set(pkg, []).get(pkg))?.push(f);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [osv]);
  return (
    <>
      <PageHead title="Security" lede={sec.statement} />
      <Card title="What was checked">
        <ul className="checks">
          <li>
            <b>Known vulnerabilities in dependencies</b>
            {sec.dependencies.assessed ? (
              <span>
                {num(sec.dependencies.packagesChecked)} packages checked against{" "}
                {sec.dependencies.source ?? "OSV"}. {num(sec.dependencies.vulnerabilities)} found.
              </span>
            ) : (
              <NotAssessed
                reason={sec.dependencies.reason}
                hint="Run an online analysis to query OSV."
              />
            )}
          </li>
          {sec.secrets.map((s) => (
            <li key={s.tool}>
              <b>Secrets, {s.tool}</b>
              {s.assessed ? (
                <span>{num(s.findings)} possible secrets. Values are never stored in reports.</span>
              ) : (
                <NotAssessed reason={s.reason} />
              )}
            </li>
          ))}
          <li>
            <b>CI workflow risks</b>
            {sec.workflows.assessed ? (
              <span>{num(sec.workflows.findings)} findings.</span>
            ) : (
              <NotAssessed reason={sec.workflows.reason} />
            )}
          </li>
        </ul>
      </Card>
      <Card title="Vulnerable packages">
        {byPkg.length === 0 ? (
          <Empty
            title={
              sec.dependencies.assessed
                ? "No known vulnerabilities in the checked packages"
                : "Not checked"
            }
          >
            This does not mean the code is secure. It means OSV lists no advisory for these package
            versions.
          </Empty>
        ) : (
          <DataTable
            caption="Vulnerable packages"
            rows={byPkg}
            rowKey={([p]) => p}
            onRow={([, list]) => select({ kind: "finding", id: (list[0] as Finding).id })}
            columns={[
              {
                key: "p",
                label: "Package",
                render: ([p]) => <span className="mono">{p}</span>,
                sort: ([p]) => p,
              },
              {
                key: "n",
                label: "Advisories",
                align: "right",
                render: ([, l]) => <span className="num">{l.length}</span>,
                sort: ([, l]) => l.length,
              },
              {
                key: "fix",
                label: "Fix",
                secondary: true,
                render: ([, l]) => {
                  const fix = l[0]?.tags.find((t) => t.startsWith("fix:"))?.slice(4);
                  const jump = l[0]?.tags.find((t) => t.startsWith("jump:"))?.slice(5);
                  return fix ? (
                    <span className="small">
                      {fix} ({jump} update)
                    </span>
                  ) : (
                    <span className="muted small">No fixed version listed</span>
                  );
                },
              },
              {
                key: "scope",
                label: "Scope",
                secondary: true,
                render: ([, l]) => (
                  <Chip tone="muted">
                    {l[0]?.tags.includes("dev") ? "Development only" : "Runtime"}
                  </Chip>
                ),
              },
            ]}
          />
        )}
      </Card>
      <Card title="Secrets and workflow findings">
        <FindingsList items={other} empty="No secret or workflow findings." />
      </Card>
    </>
  );
}

/* ---------- Practices ---------- */
export function Practices() {
  const { report } = useReport();
  const p = report.practices;
  const d = p.documentation;
  const rows: { area: string; items: { label: string; ok: boolean | null; note?: string }[] }[] = [
    {
      area: "Testing and continuous integration",
      items: [
        {
          label: "Tests",
          ok: p.tests.testFiles > 0,
          note: `${p.tests.testFiles} test files for ${p.tests.sourceFiles} source files${p.tests.frameworks.length ? ` (${p.tests.frameworks.join(", ")})` : ""}`,
        },
        {
          label: "Continuous integration",
          ok: p.ci.providers.length > 0,
          note: p.ci.providers.join(", ") || "none detected",
        },
        {
          label: "Test coverage report",
          ok: report.testCoverage.ingested,
          note: report.testCoverage.ingested
            ? `${pct(report.testCoverage.lineRate, 1)} of lines`
            : "Not ingested. Pass a coverage report with --coverage.",
        },
      ],
    },
    {
      area: "Code quality tooling",
      items: [
        {
          label: "Linter",
          ok: p.quality.linters.length > 0,
          note: p.quality.linters.join(", ") || "none detected",
        },
        {
          label: "Formatter",
          ok: p.quality.formatters.length > 0,
          note: p.quality.formatters.join(", ") || "none detected",
        },
        {
          label: "Type checker",
          ok: p.quality.typeCheckers.length > 0,
          note: p.quality.typeCheckers.join(", ") || "none detected",
        },
      ],
    },
    {
      area: "Documentation",
      items: [
        {
          label: "README",
          ok: d.readme.path !== null,
          note: d.readme.path
            ? `${d.readme.words ?? 0} words, sections: ${d.readme.sections.join(", ") || "none"}`
            : "missing",
        },
        { label: "Install instructions", ok: d.readme.hasInstall },
        { label: "Usage instructions", ok: d.readme.hasUsage },
        { label: "Decision records", ok: d.adrCount > 0, note: `${d.adrCount} found` },
        { label: "Docs folder", ok: d.docsDirectory },
      ],
    },
    {
      area: "Community files",
      items: [
        {
          label: "License",
          ok: d.files.license,
          note: report.detection.license.spdxGuess ?? undefined,
        },
        { label: "Contributing guide", ok: d.files.contributing },
        { label: "Code of conduct", ok: d.files.codeOfConduct },
        { label: "Security policy", ok: d.files.security },
        { label: "Changelog", ok: d.files.changelog },
      ],
    },
    {
      area: "Setup aids",
      items: [
        { label: "Dockerfile", ok: p.setup.dockerfile },
        { label: "Environment example", ok: p.setup.envExample },
        { label: "Makefile", ok: p.setup.makefile },
        { label: "Dev container", ok: p.setup.devcontainer },
      ],
    },
  ];
  return (
    <>
      <PageHead
        title="Practices"
        lede="What exists and what is missing. Documentation is checked for presence and sections, never for how well it is written."
      />
      <div className="cols-2">
        {rows.map((g) => (
          <Card key={g.area} title={g.area}>
            <ul className="checklist">
              {g.items.map((i) => (
                <li key={i.label}>
                  <span
                    className={`tick ${i.ok === null ? "tick-na" : i.ok ? "tick-yes" : "tick-no"}`}
                  >
                    <span className="sr-only">
                      {i.ok === null ? "Not assessed" : i.ok ? "Present" : "Missing"}
                    </span>
                  </span>
                  <span>
                    <b>{i.label}</b>
                    {i.note ? <span className="small muted"> {i.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {report.detection.frameworks.length > 0 ? (
        <Card title="Detected stack">
          <ul className="chips">
            {report.detection.frameworks.map((f) => (
              <li key={f.name}>
                <Chip>{f.name}</Chip>
              </li>
            ))}
            {[...report.detection.packageManagers, ...report.detection.buildTools].map((x) => (
              <li key={x}>
                <Chip tone="muted">{x}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

/* ---------- History ---------- */
export function History() {
  const { report, select } = useReport();
  const h = report.history;
  if (!h.available)
    return (
      <>
        <PageHead
          title="History"
          lede="Contributors, hotspots and working habits, read from Git."
        />
        <NotAssessed
          reason={h.reason}
          hint="Analyze a local checkout or a GitHub URL with history enabled."
        />
      </>
    );
  return (
    <>
      <PageHead
        title="History"
        lede={`Read from ${h.source === "git" ? "the local Git history" : "a sample of recent commits through the GitHub API"}. These signals describe habits, not the quality of the code.`}
      />
      <div className="grid-stats">
        <Stat
          label="Commits analyzed"
          value={num(h.commitsAnalyzed)}
          note={h.shallow ? "Shallow clone: history is incomplete" : undefined}
        />
        <Stat
          label="Contributors"
          value={num(h.contributors.length)}
          note={h.topAuthorShare !== null ? `Top author made ${pct(h.topAuthorShare)}` : undefined}
        />
        <Stat
          label="Merged pull requests"
          value={h.pullRequests ? num(h.pullRequests.merged) : "n/a"}
          note={
            h.pullRequests?.medianHoursToMerge
              ? `Median ${h.pullRequests.medianHoursToMerge} h to merge`
              : undefined
          }
        />
        <Stat label="Releases" value={h.releases ? num(h.releases.count) : "n/a"} />
      </div>
      <div className="cols-2">
        <Card title="Contributors">
          <ul className="share-list">
            {h.contributors.slice(0, 10).map((c) => (
              <li key={c.name}>
                <div className="factor-row">
                  <span>{c.name}</span>
                  <span className="num muted">
                    {c.commits} commits, {pct(c.share)}
                  </span>
                </div>
                <Bar value={c.share * 100} label={`${c.name} made ${pct(c.share)} of commits`} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title={<Term id="commit-quality">Commit messages</Term>}>
          {h.commitQuality ? (
            <ul className="share-list">
              {[
                ["Follow Conventional Commits", h.commitQuality.conventionalShare],
                ["Descriptive", h.commitQuality.descriptiveShare],
                ["Generic, such as update or wip", h.commitQuality.genericShare],
              ].map(([l, v]) => (
                <li key={l as string}>
                  <div className="factor-row">
                    <span>{l}</span>
                    <span className="num muted">{pct(v as number)}</span>
                  </div>
                  <Bar value={(v as number) * 100} label={`${l} ${pct(v as number)}`} />
                </li>
              ))}
              <li className="small muted">
                Based on {h.commitQuality.sampled} commits without merges.
              </li>
            </ul>
          ) : (
            <NotAssessed reason="No commit subjects to measure." />
          )}
        </Card>
      </div>
      <Card title={<Term id="hotspot">Hotspots</Term>}>
        {h.hotspots.length > 0 ? (
          <DataTable
            caption="Hotspots"
            rows={h.hotspots}
            rowKey={(x) => x.path}
            onRow={(x) => select({ kind: "file", path: x.path })}
            initialSort={{ key: "score", dir: "desc" }}
            columns={[
              {
                key: "p",
                label: "File",
                render: (x) => <span className="mono">{x.path}</span>,
                sort: (x) => x.path,
              },
              {
                key: "score",
                label: "Score",
                align: "right",
                render: (x) => <span className="num">{x.score ?? "n/a"}</span>,
                sort: (x) => x.score,
              },
              {
                key: "c",
                label: "Commits",
                align: "right",
                secondary: true,
                render: (x) => <span className="num">{x.commits}</span>,
                sort: (x) => x.commits,
              },
              {
                key: "ch",
                label: "Churn",
                align: "right",
                secondary: true,
                render: (x) => <span className="num">{num(x.churn)}</span>,
                sort: (x) => x.churn,
              },
              {
                key: "cx",
                label: "Complexity",
                align: "right",
                secondary: true,
                render: (x) => <span className="num">{x.complexity ?? "n/a"}</span>,
                sort: (x) => x.complexity,
              },
            ]}
          />
        ) : (
          <NotAssessed reason="File level history needs a local checkout. The GitHub API sample has no per-file data." />
        )}
      </Card>
      <Card title="Limits">
        <ul className="plain-list small">
          {h.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
      <FactorsNote />
    </>
  );
}

function FactorsNote() {
  return null;
}

export { FactorBars };
