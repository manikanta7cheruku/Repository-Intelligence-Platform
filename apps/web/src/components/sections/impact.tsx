"use client";

import { impactOf } from "@repolens/core/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { GraphLegend, graphExportSvg, LayeredGraph } from "@/components/layered-graph";
import { useReport } from "@/components/report-context";
import { Card, Empty, PageHead, Stat, Term } from "@/components/ui";
import { dateText, num } from "@/lib/format";
import type { GEdge, GNode } from "@/lib/layout";
import { fileStem } from "@/lib/svg";

const CAP = 90;

export function Impact() {
  const { id, report, reverse, nodeByPath, select, modulePathOf } = useReport();
  const router = useRouter();
  const params = useSearchParams();
  const file = params.get("file");
  const [q, setQ] = useState("");

  const choose = (path: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (path) sp.set("file", path);
    else sp.delete("file");
    router.replace(`/r/${id}/impact${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return report.graph.nodes
      .filter((n) => n.path.toLowerCase().includes(t))
      .sort((a, b) => b.fanIn - a.fanIn)
      .slice(0, 8);
  }, [q, report]);

  const impact = file ? impactOf(reverse, file) : null;

  const graph = useMemo(() => {
    if (!file || !impact) return null;
    const start = reverse.idByPath.get(file);
    if (!start) return null;
    const depth = new Map<string, number>([[start, 0]]);
    let frontier = [start];
    let d = 0;
    while (frontier.length > 0 && depth.size < CAP) {
      d++;
      const next: string[] = [];
      for (const v of frontier)
        for (const { id: from } of reverse.rev.get(v) ?? [])
          if (!depth.has(from) && depth.size < CAP) {
            depth.set(from, d);
            next.push(from);
          }
      frontier = next;
    }
    const keep = new Set(depth.keys());
    const nodes: GNode[] = [...keep].map((nid) => {
      const path = reverse.pathById.get(nid) ?? nid;
      const n = report.graph.nodes.find((x) => x.id === nid);
      return {
        id: nid,
        label: path.split("/").slice(-2).join("/"),
        sub:
          nid === start
            ? "selected file"
            : `${depth.get(nid)} step${depth.get(nid) === 1 ? "" : "s"} away`,
        kind: nid === start ? "target" : "file",
        size: n?.fanIn ?? 0,
      };
    });
    const edges: GEdge[] = report.graph.edges
      .filter((e) => keep.has(e.from) && keep.has(e.to))
      .map((e) => ({ from: e.from, to: e.to, typeOnly: e.typeOnly }));
    return { nodes, edges, start, truncated: depth.size >= CAP };
  }, [file, impact, reverse, report]);

  const meta = {
    title: file ? `Change impact of ${file}` : "Change impact",
    repo: report.repository.name,
    commit: report.repository.commitSha,
    date: dateText(report.reproducibility.finishedAt),
    tool: `RepoLens ${report.reproducibility.toolVersion}`,
    legend: [
      "Dark box: the file that changes",
      "Everything to its left imports it, directly or through other files",
    ],
  };

  return (
    <>
      <PageHead
        title="Impact"
        lede={
          <>
            Pick a file to see what could break if it changes. This follows static imports only, so
            treat the <Term id="blast-radius">blast radius</Term> as the minimum set to check, not
            the full set.
          </>
        }
        actions={
          graph && file ? (
            <ExportMenu
              source={{
                stem: fileStem(report.repository.name, "impact"),
                title: meta.title,
                svg: () => graphExportSvg(graph.nodes, graph.edges, graph.start, meta),
                data: () => ({ file, impact, nodes: graph.nodes, edges: graph.edges }),
              }}
            />
          ) : null
        }
      />

      <Card title="Choose a file">
        <div className="picker">
          <input
            className="input"
            type="search"
            placeholder="Type part of a file name"
            aria-label="Find a file"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="pick-list">
              {matches.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="pick"
                    onClick={() => {
                      choose(n.path);
                      setQ("");
                    }}
                  >
                    <span className="mono">{n.path}</span>
                    <span className="muted small">imported by {n.fanIn}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {file ? (
          <p className="small">
            Selected: <span className="mono">{file}</span>{" "}
            <button type="button" className="textlink" onClick={() => choose(null)}>
              Clear
            </button>
          </p>
        ) : null}
      </Card>

      {file && impact && graph ? (
        <>
          <div className="grid-stats">
            <Stat label="Directly import it" value={num(impact.directDependents)} />
            <Stat
              label="Affected in total"
              value={num(impact.transitiveDependents)}
              note={`${num(impact.runtimeTransitive)} through runtime imports`}
            />
            <Stat label="Longest chain" value={impact.maxDepth} note="steps from the file" />
            <Stat
              label="Modules and entrypoints"
              value={`${impact.modulesAffected.length} / ${impact.entrypointsAffected.length}`}
              note="modules / entrypoints"
            />
          </div>
          <Card title="Who is affected">
            {graph.truncated ? (
              <p className="note small">
                The graph shows the {CAP} nearest files. The numbers above count everything.
              </p>
            ) : null}
            <LayeredGraph
              nodes={graph.nodes}
              edges={graph.edges}
              label={meta.title}
              selectedId={null}
              height={520}
              onOpen={(nid) => {
                const p = reverse.pathById.get(nid);
                if (p) select({ kind: "file", path: p });
              }}
            />
            <GraphLegend
              items={[
                { swatch: "target", text: "File that changes" },
                { swatch: "in", text: "Imports it (affected)" },
                { swatch: "type", text: "Type-only import" },
              ]}
            />
          </Card>
          <div className="cols-2">
            <Card title="Modules affected">
              <ul className="plain-list mono small">
                {impact.modulesAffected.map((m) => (
                  <li key={m}>{m}</li>
                ))}
                {impact.modulesAffected.length === 0 ? <li className="muted">None.</li> : null}
              </ul>
            </Card>
            <Card title="Entrypoints affected">
              <ul className="plain-list mono small">
                {impact.entrypointsAffected.map((m) => (
                  <li key={m}>{m}</li>
                ))}
                {impact.entrypointsAffected.length === 0 ? (
                  <li className="muted">None detected. This does not prove the file is unused.</li>
                ) : null}
              </ul>
            </Card>
          </div>
        </>
      ) : file ? (
        <Empty title="This file is not in the dependency graph">
          Tests, documentation and files in languages without an import analyzer are not part of the
          graph.
        </Empty>
      ) : (
        <Card title="Files with the widest reach">
          <DataTable
            caption="Files ranked by how many files depend on them"
            rows={[...report.blastRadius].sort(
              (a, b) => b.transitiveDependents - a.transitiveDependents,
            )}
            rowKey={(b) => b.path}
            onRow={(b) => choose(b.path)}
            columns={[
              {
                key: "path",
                label: "File",
                render: (b) => <span className="mono">{b.path}</span>,
                sort: (b) => b.path,
              },
              {
                key: "d",
                label: "Direct",
                align: "right",
                render: (b) => <span className="num">{b.directDependents}</span>,
                sort: (b) => b.directDependents,
              },
              {
                key: "t",
                label: "Total",
                align: "right",
                render: (b) => <span className="num">{b.transitiveDependents}</span>,
                sort: (b) => b.transitiveDependents,
              },
              {
                key: "m",
                label: "Modules",
                align: "right",
                secondary: true,
                render: (b) => <span className="num">{b.modulesAffected.length}</span>,
                sort: (b) => b.modulesAffected.length,
              },
              {
                key: "e",
                label: "Entrypoints",
                align: "right",
                secondary: true,
                render: (b) => <span className="num">{b.entrypointsAffected.length}</span>,
                sort: (b) => b.entrypointsAffected.length,
              },
            ]}
            initialSort={{ key: "t", dir: "desc" }}
          />
        </Card>
      )}
      {file && nodeByPath.get(file) ? (
        <p className="small muted">
          Module: <span className="mono">{modulePathOf(nodeByPath.get(file)?.moduleId ?? "")}</span>
        </p>
      ) : null}
    </>
  );
}
