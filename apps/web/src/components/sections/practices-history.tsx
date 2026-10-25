"use client";

import { DataTable } from "@/components/data-table";
import { useReport } from "@/components/report-context";
import { Bar, Card, Chip, NotAssessed, PageHead, Stat, Term } from "@/components/ui";
import { dateText, num, pct } from "@/lib/format";

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
          label="Commits"
          value={num(h.totalCommits ?? h.commitsAnalyzed)}
          note={
            h.shallow
              ? "Shallow clone: history is incomplete"
              : h.exactTotals
                ? `Whole history, ${num(h.commitsAnalyzed)} examined in detail`
                : "In the analyzed window"
          }
        />
        <Stat
          label="Contributors"
          value={
            h.totalContributors === null
              ? num(h.contributors.length)
              : `${h.totalContributorsAtLeast ? "100+" : num(h.totalContributors)}`
          }
          note={h.topAuthorShare !== null ? `Top author made ${pct(h.topAuthorShare)}` : undefined}
        />
        <Stat
          label="Merged pull requests"
          value={h.pullRequests ? num(h.pullRequests.merged) : "n/a"}
          note={
            h.pullRequests
              ? `${h.pullRequests.exact ? "All time" : "Recent sample only"}${
                  h.pullRequests.medianHoursToMerge
                    ? `, median ${h.pullRequests.medianHoursToMerge} h to merge`
                    : ""
                }`
              : "Needs network access to GitHub"
          }
        />
        <Stat
          label="Releases"
          value={h.releases ? num(h.releases.count) : "n/a"}
          note={h.releases ? undefined : "Needs network access to GitHub"}
        />
      </div>
      <p className="small muted num">
        First commit {dateText(h.window.first)}, latest {dateText(h.window.last)}.
      </p>
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
    </>
  );
}
