"use client";

import type { Finding } from "@repolens/core/browser";
import { useMemo, useRef } from "react";
import { ComplexityBar, HotspotScatter, LanguageBar, useChartExport } from "@/components/charts";
import { DataTable } from "@/components/data-table";
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
