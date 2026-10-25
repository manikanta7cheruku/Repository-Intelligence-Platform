"use client";

import {
  DIMENSION_LABELS,
  diffReports,
  diffToMarkdown,
  type Report,
  toDot,
  toMermaid,
  validateReport,
} from "@repolens/core/browser";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { FindingsList } from "@/components/findings";
import { graphExportSvg } from "@/components/layered-graph";
import { useReport } from "@/components/report-context";
import {
  Card,
  Chip,
  Empty,
  NotAssessed,
  PageHead,
  Segmented,
  SeverityBadge,
} from "@/components/ui";
import { dateText, dec, num, shortSha } from "@/lib/format";
import type { GEdge, GNode } from "@/lib/layout";
import { download, fileStem } from "@/lib/svg";

/* ---------- Rules ---------- */
export function Rules() {
  const { report } = useReport();
  const r = report.rules;
  const violations = report.findings.filter((f) => f.ruleId.startsWith("rule."));
  return (
    <>
      <PageHead
        title="Rules"
        lede="Architecture rules you write in a YAML file, such as which layer may import which. RIP checks every import against them and shows the line."
      />
      {!r.evaluated ? (
        <Card>
          <NotAssessed
            reason="No rules file was supplied."
            hint="Add repolens.rules.yaml to the repository and analyze again. The Architecture score then uses all five of its inputs."
          />
          <pre className="code">{`version: 1
layers:
  - name: domain
    paths: ["packages/domain/**"]
  - name: persistence
    paths: ["packages/persistence/**"]
rules:
  - id: domain-is-pure
    severity: high
    allowOnly:
      from: domain
      to: []`}</pre>
        </Card>
      ) : (
        <>
          <Card title={`Rules in ${r.source ?? "the rules file"}`}>
            <DataTable
              caption="Architecture rules"
              rows={r.rules}
              rowKey={(x) => x.id}
              columns={[
                { key: "id", label: "Rule", render: (x) => <span className="mono">{x.id}</span> },
                {
                  key: "t",
                  label: "Type",
                  render: (x) => <Chip tone="muted">{x.type}</Chip>,
                  secondary: true,
                },
                {
                  key: "s",
                  label: "Severity",
                  render: (x) => <SeverityBadge severity={x.severity} />,
                },
                {
                  key: "d",
                  label: "Description",
                  secondary: true,
                  render: (x) => <span className="small">{x.description ?? ""}</span>,
                },
              ]}
            />
            {r.baseline ? (
              <p className="small muted">
                Baseline {r.baseline.source ?? ""} suppresses {r.baseline.suppressed} known
                violations.
              </p>
            ) : null}
          </Card>
          <Card title={`Violations (${r.violations ?? 0})`}>
            <FindingsList
              items={violations}
              empty="No rule violations. Every checked import follows the rules."
            />
          </Card>
        </>
      )}
    </>
  );
}

/* ---------- Compare ---------- */
export function Compare() {
  const { report } = useReport();
  const [other, setOther] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"earlier" | "later">("earlier");

  const onFile = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as unknown;
      const v = validateReport(data);
      if (!v.valid) {
        setOther(null);
        setError(`Not a valid report: ${v.issues[0]?.path ?? ""} ${v.issues[0]?.message ?? ""}`);
        return;
      }
      setOther(data as Report);
    } catch {
      setOther(null);
      setError("That file is not JSON.");
    }
  };

  const [a, b] = role === "earlier" ? [other, report] : [report, other];
  const diff = useMemo(() => (a && b ? diffReports(a, b) : null), [a, b]);
  const titleOf = (
    id: string,
  ): { title: string; sev: Report["findings"][number]["severity"] } | null => {
    const f = b?.findings.find((x) => x.id === id) ?? a?.findings.find((x) => x.id === id);
    return f ? { title: f.title, sev: f.severity } : null;
  };
  return (
    <>
      <PageHead
        title="Compare"
        lede="Open a second report of the same repository, for example from an earlier commit, to see how scores, findings and dependencies changed. The file is read in your browser and never uploaded."
      />
      <Card title="Second report">
        <div className="picker-row">
          <label className="btn">
            Choose report.json
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {other ? (
            <span className="small">
              {other.repository.name} at{" "}
              <span className="mono">{shortSha(other.repository.commitSha)}</span>,{" "}
              {dateText(other.reproducibility.finishedAt)}
            </span>
          ) : (
            <span className="small muted">No file chosen.</span>
          )}
          <Segmented
            label="Role of the chosen report"
            value={role}
            onChange={setRole}
            options={[
              { value: "earlier", label: "It is the earlier one" },
              { value: "later", label: "It is the later one" },
            ]}
          />
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </Card>
      {diff && a && b ? (
        <>
          <Card title="Summary">
            <ul className="plain-list">
              {diff.summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                download(
                  `${fileStem(report.repository.name, "compare")}.md`,
                  diffToMarkdown(diff),
                  "text/markdown",
                )
              }
            >
              Download as Markdown
            </button>
          </Card>
          <Card title="Scores">
            <DataTable
              caption="Score changes"
              rows={diff.scores}
              rowKey={(s) => s.dimension}
              columns={[
                {
                  key: "d",
                  label: "Dimension",
                  render: (s) => DIMENSION_LABELS[s.dimension] ?? s.dimension,
                },
                {
                  key: "f",
                  label: "Earlier",
                  align: "right",
                  render: (s) => <span className="num">{s.from ?? "n/a"}</span>,
                },
                {
                  key: "t",
                  label: "Later",
                  align: "right",
                  render: (s) => <span className="num">{s.to ?? "n/a"}</span>,
                },
                {
                  key: "x",
                  label: "Change",
                  align: "right",
                  render: (s) => (
                    <span
                      className={`num delta ${s.delta === null || s.delta === 0 ? "" : s.delta > 0 ? "delta-up" : "delta-down"}`}
                    >
                      {s.delta === null ? "n/a" : s.delta > 0 ? `+${s.delta}` : s.delta}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
          <div className="cols-2">
            <Card title={`New findings (${diff.findings.added.length})`}>
              <ul className="plain-list">
                {diff.findings.added.slice(0, 30).map((id) => {
                  const t = titleOf(id);
                  return (
                    <li key={id}>
                      {t ? <SeverityBadge severity={t.sev} /> : null} {t?.title ?? id}
                    </li>
                  );
                })}
                {diff.findings.added.length === 0 ? <li className="muted">None.</li> : null}
              </ul>
            </Card>
            <Card title={`Resolved findings (${diff.findings.resolved.length})`}>
              <ul className="plain-list">
                {diff.findings.resolved.slice(0, 30).map((id) => (
                  <li key={id}>{titleOf(id)?.title ?? id}</li>
                ))}
                {diff.findings.resolved.length === 0 ? <li className="muted">None.</li> : null}
              </ul>
            </Card>
          </div>
          <div className="cols-2">
            <Card title={`Dependencies added (${diff.edges.added.length})`}>
              <ul className="plain-list mono small">
                {diff.edges.added.slice(0, 25).map(([x, y]) => (
                  <li key={`${x}>${y}`}>
                    {x} <span className="muted">imports</span> {y}
                  </li>
                ))}
                {diff.edges.added.length === 0 ? <li className="muted">None.</li> : null}
              </ul>
            </Card>
            <Card title={`Dependencies removed (${diff.edges.removed.length})`}>
              <ul className="plain-list mono small">
                {diff.edges.removed.slice(0, 25).map(([x, y]) => (
                  <li key={`${x}>${y}`}>
                    {x} <span className="muted">imports</span> {y}
                  </li>
                ))}
                {diff.edges.removed.length === 0 ? <li className="muted">None.</li> : null}
              </ul>
            </Card>
          </div>
        </>
      ) : (
        <Empty title="Choose a second report to compare">
          Create one with <span className="mono">repolens analyze . -f json</span> at another
          commit.
        </Empty>
      )}
    </>
  );
}

/* ---------- Export ---------- */
export function ExportPage() {
  const { report } = useReport();
  const stem = (v: string) => fileStem(report.repository.name, v);
  const meta = {
    title: "Module dependency map",
    repo: report.repository.name,
    commit: report.repository.commitSha,
    date: dateText(report.reproducibility.finishedAt),
    tool: `RepoLens ${report.reproducibility.toolVersion}`,
    legend: ["Arrows read: importer to dependency", "Red outline: part of a cycle"],
  };
  const modMap = () => {
    const cyc = new Set<string>();
    for (const c of report.graph.cycles)
      if (c.scope === "module") for (const m of c.members) cyc.add(m);
    const mods = [...report.graph.modules].sort((x, y) => y.fileCount - x.fileCount).slice(0, 60);
    const keep = new Set(mods.map((m) => m.id));
    const nodes: GNode[] = mods.map((m) => ({
      id: m.id,
      label: m.path,
      sub: `${m.fileCount} files, ${num(m.loc)} lines`,
      size: m.fileCount,
      kind: "module",
      inCycle: cyc.has(m.id),
    }));
    const edges: GEdge[] = report.graph.moduleEdges
      .filter((e) => keep.has(e.from) && keep.has(e.to))
      .map((e) => ({
        from: e.from,
        to: e.to,
        weight: e.weight,
        cycle: cyc.has(e.from) && cyc.has(e.to),
      }));
    return graphExportSvg(nodes, edges, null, meta);
  };
  const csv = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [
      ["id", "severity", "confidence", "category", "rule", "title", "location"].join(","),
    ];
    for (const f of report.findings)
      rows.push(
        [
          f.id,
          f.severity,
          f.confidence,
          f.category,
          f.ruleId,
          q(f.title),
          q(
            f.locations[0]
              ? `${f.locations[0].path}${f.locations[0].startLine ? `:${f.locations[0].startLine}` : ""}`
              : "",
          ),
        ].join(","),
      );
    return `${rows.join("\n")}\n`;
  };
  const items: { title: string; text: string; ext: string; run: () => void }[] = [
    {
      title: "Full report",
      text: "The complete report as JSON (schema 0.4.0). Open it again here, or compare it later.",
      ext: "JSON",
      run: () =>
        download(`${stem("report")}.json`, JSON.stringify(report, null, 2), "application/json"),
    },
    {
      title: "Module map",
      text: "The dependency map as a vector image with title, legend and commit.",
      ext: "SVG",
      run: () => download(`${stem("structure")}.svg`, modMap(), "image/svg+xml"),
    },
    {
      title: "Mermaid diagram",
      text: "Paste into any Mermaid renderer or a Markdown file.",
      ext: "MMD",
      run: () => download(`${stem("structure")}.mmd`, toMermaid(report), "text/plain"),
    },
    {
      title: "Graphviz DOT",
      text: "For Graphviz or other graph tools.",
      ext: "DOT",
      run: () => download(`${stem("structure")}.dot`, toDot(report), "text/plain"),
    },
    {
      title: "Findings table",
      text: "Every finding with severity, rule and location.",
      ext: "CSV",
      run: () => download(`${stem("findings")}.csv`, csv(), "text/csv"),
    },
  ];
  return (
    <>
      <PageHead
        title="Export"
        lede="Everything is generated in your browser. Charts and diagrams also have an Export menu on their own page, with SVG, PNG at 2x and PDF."
      />
      <div className="export-grid">
        {items.map((i) => (
          <button key={i.title} type="button" className="export-card" onClick={i.run}>
            <span className="export-ext mono">{i.ext}</span>
            <b>{i.title}</b>
            <span className="small muted">{i.text}</span>
          </button>
        ))}
      </div>
      <p className="small muted">
        Exports use the light theme so they read well in documents. Maximum detail:{" "}
        <span className="num">{dec(report.graph.nodes.length, 0)}</span> files in the dependency
        graph.
      </p>
    </>
  );
}
