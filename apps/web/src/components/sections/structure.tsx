"use client";

import { toDot, toMermaid, toMermaidFiles } from "@repolens/core/browser";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { GraphLegend, graphExportSvg, LayeredGraph } from "@/components/layered-graph";
import { useReport } from "@/components/report-context";
import { Card, Chip, Empty, PageHead, Segmented, Term } from "@/components/ui";
import { dateText, dec, num } from "@/lib/format";
import type { GEdge, GNode } from "@/lib/layout";
import { fileStem } from "@/lib/svg";

const MODULE_CAP = 60;
const FILE_CAP = 70;

export function Structure() {
  const { report, select, selection, moduleById, modulePathOf } = useReport();
  const [view, setView] = useState<"map" | "ledger">("map");
  const [query, setQuery] = useState("");
  const [cyclesOnly, setCyclesOnly] = useState(false);
  const params = useSearchParams();
  const fromUrl = params.get("module");
  const [drill, setDrill] = useState<string | null>(fromUrl);
  useEffect(() => {
    if (fromUrl) setDrill(fromUrl);
  }, [fromUrl]);

  const cycleModules = useMemo(() => {
    const s = new Set<string>();
    for (const c of report.graph.cycles)
      if (c.scope === "module") for (const m of c.members) s.add(m);
    return s;
  }, [report]);
  const cycleFiles = useMemo(() => {
    const s = new Set<string>();
    for (const c of report.graph.cycles)
      if (c.scope === "file" && !c.typeOnly) for (const m of c.members) s.add(m);
    return s;
  }, [report]);

  const model = useMemo(() => {
    const g = report.graph;
    if (drill === null) {
      let mods = [...g.modules].sort((a, b) => b.fileCount - a.fileCount);
      if (cyclesOnly) mods = mods.filter((m) => cycleModules.has(m.id));
      const hidden = Math.max(0, mods.length - MODULE_CAP);
      mods = mods.slice(0, MODULE_CAP);
      const keep = new Set(mods.map((m) => m.id));
      const nodes: GNode[] = mods.map((m) => ({
        id: m.id,
        label: m.path,
        sub: `${m.fileCount} files, ${num(m.loc)} lines`,
        size: m.fileCount,
        kind: "module",
        inCycle: cycleModules.has(m.id),
      }));
      const edges: GEdge[] = g.moduleEdges
        .filter((e) => keep.has(e.from) && keep.has(e.to))
        .map((e) => ({
          from: e.from,
          to: e.to,
          weight: e.weight,
          cycle: cycleModules.has(e.from) && cycleModules.has(e.to),
        }));
      return { nodes, edges, hidden, level: "modules" as const };
    }
    const inside = g.nodes.filter((n) => n.moduleId === drill).sort((a, b) => b.fanIn - a.fanIn);
    const shown = inside.slice(0, FILE_CAP);
    const ids = new Set(shown.map((n) => n.id));
    const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
    const nodes: GNode[] = shown.map((n) => ({
      id: n.id,
      label: n.path.split("/").slice(-2).join("/"),
      sub: `imported by ${n.fanIn}, imports ${n.fanOut}`,
      size: n.fanIn,
      kind: "file",
      inCycle: cycleFiles.has(n.id),
    }));
    const edges: GEdge[] = [];
    const ext = new Map<string, number>();
    for (const e of g.edges) {
      const a = ids.has(e.from);
      const b = ids.has(e.to);
      if (a && b)
        edges.push({
          from: e.from,
          to: e.to,
          typeOnly: e.typeOnly,
          cycle: cycleFiles.has(e.from) && cycleFiles.has(e.to),
        });
      else if (a || b) {
        const other = nodeById.get(a ? e.to : e.from);
        if (other && other.moduleId !== drill) {
          const key = `ext:${other.moduleId}`;
          ext.set(key, (ext.get(key) ?? 0) + 1);
          edges.push({ from: a ? e.from : key, to: a ? key : e.to, typeOnly: e.typeOnly });
        }
      }
    }
    // Merge repeated edges to the same external module.
    const seen = new Set<string>();
    const merged = edges.filter((e) => {
      const k = `${e.from}>${e.to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    for (const key of ext.keys())
      nodes.push({
        id: key,
        label: modulePathOf(key.slice(4)),
        sub: `${ext.get(key)} imports across the boundary`,
        kind: "external",
      });
    return {
      nodes,
      edges: merged,
      hidden: Math.max(0, inside.length - FILE_CAP),
      level: "files" as const,
    };
  }, [report, drill, cyclesOnly, cycleModules, cycleFiles, modulePathOf]);

  const selectedId =
    selection?.kind === "module"
      ? selection.id
      : selection?.kind === "file"
        ? (report.graph.nodes.find((n) => n.path === selection.path)?.id ?? null)
        : null;

  const open = (id: string) => {
    if (id.startsWith("ext:")) return setDrill(id.slice(4));
    if (drill === null) select({ kind: "module", id });
    else {
      const n = report.graph.nodes.find((x) => x.id === id);
      if (n) select({ kind: "file", path: n.path });
    }
  };

  const meta = {
    title: drill === null ? "Module dependency map" : `Files in ${modulePathOf(drill)}`,
    repo: report.repository.name,
    commit: report.repository.commitSha,
    date: dateText(report.reproducibility.finishedAt),
    tool: `RepoLens ${report.reproducibility.toolVersion}`,
    legend: [
      "Arrows read: importer to dependency, left to right",
      "Red outline: part of a cycle",
      "Dashed line: type-only import",
    ],
  };
  const exportSource = {
    stem: fileStem(report.repository.name, drill === null ? "structure" : "structure-files"),
    title: meta.title,
    svg: () => graphExportSvg(model.nodes, model.edges, selectedId, meta),
    data: () => ({ nodes: model.nodes, edges: model.edges }),
    text: [
      {
        label: "Mermaid diagram",
        ext: "mmd",
        type: "text/plain",
        build: () =>
          drill === null
            ? toMermaid(report)
            : (toMermaidFiles(report, modulePathOf(drill)) ?? toMermaid(report)),
      },
      { label: "Graphviz DOT", ext: "dot", type: "text/plain", build: () => toDot(report) },
    ],
  };

  const modules = report.graph.modules;
  return (
    <>
      <PageHead
        title="Structure"
        lede={
          <>
            How the code is organized. A <Term id="module">module</Term> is a directory or package.
            An arrow means the left side imports the right side. Open a module to see why it
            matters, or open its files.
          </>
        }
        actions={<ExportMenu source={exportSource} />}
      />

      <Card>
        <div className="toolbar">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "map", label: "Map" },
              { value: "ledger", label: "Ledger" },
            ]}
          />
          {view === "map" ? (
            <>
              <input
                className="input input-sm"
                type="search"
                placeholder={drill === null ? "Find a module" : "Find a file"}
                aria-label="Find in the map"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {drill === null ? (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={cyclesOnly}
                    onChange={(e) => setCyclesOnly(e.target.checked)}
                  />
                  Cycles only
                </label>
              ) : null}
              {drill !== null ? (
                <button type="button" className="btn btn-sm" onClick={() => setDrill(null)}>
                  Back to modules
                </button>
              ) : selection?.kind === "module" ? (
                <button type="button" className="btn btn-sm" onClick={() => setDrill(selection.id)}>
                  Open files of this module
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {view === "map" ? (
          <>
            {model.hidden > 0 ? (
              <p className="note small">
                Showing the {drill === null ? MODULE_CAP : FILE_CAP} largest of{" "}
                {model.hidden + (drill === null ? MODULE_CAP : FILE_CAP)}. Use the Ledger to see
                every row.
              </p>
            ) : null}
            <LayeredGraph
              nodes={model.nodes}
              edges={model.edges}
              label={meta.title}
              onOpen={open}
              selectedId={selectedId}
              query={query}
              emptyText={cyclesOnly ? "No modules are part of a cycle." : "No modules to draw."}
            />
            <GraphLegend
              items={[
                { swatch: "out", text: "Imports (outgoing)" },
                { swatch: "in", text: "Used by (incoming)" },
                { swatch: "cycle", text: "In a cycle" },
                { swatch: "type", text: "Type-only import" },
              ]}
            />
            <p className="small muted">
              Drag to pan, scroll or pinch to zoom, press Tab to move between nodes and Enter to
              open one. Hover or focus a node to highlight what it uses and what uses it.
            </p>
          </>
        ) : (
          <DataTable
            caption="Modules"
            rows={modules}
            rowKey={(m) => m.id}
            onRow={(m) => select({ kind: "module", id: m.id })}
            initialSort={{ key: "files", dir: "desc" }}
            columns={[
              {
                key: "path",
                label: "Module",
                render: (m) => <span className="mono">{m.path}</span>,
                sort: (m) => m.path,
              },
              {
                key: "files",
                label: "Files",
                align: "right",
                render: (m) => <span className="num">{m.fileCount}</span>,
                sort: (m) => m.fileCount,
              },
              {
                key: "loc",
                label: "Lines",
                align: "right",
                render: (m) => <span className="num">{num(m.loc)}</span>,
                sort: (m) => m.loc,
              },
              {
                key: "fanin",
                label: "Used by",
                align: "right",
                secondary: true,
                render: (m) => <span className="num">{num(m.fanIn)}</span>,
                sort: (m) => m.fanIn,
              },
              {
                key: "fanout",
                label: "Uses",
                align: "right",
                secondary: true,
                render: (m) => <span className="num">{num(m.fanOut)}</span>,
                sort: (m) => m.fanOut,
              },
              {
                key: "inst",
                label: "Instability",
                align: "right",
                secondary: true,
                render: (m) => <span className="num">{dec(m.instability)}</span>,
                sort: (m) => m.instability,
              },
              {
                key: "cycle",
                label: "Cycle",
                secondary: true,
                render: (m) =>
                  cycleModules.has(m.id) ? (
                    <Chip>In a cycle</Chip>
                  ) : (
                    <span className="muted">No</span>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Card title="Cycles">
        {report.graph.cycles.length === 0 ? (
          <Empty title="No circular dependencies found">
            Files and modules can be understood and changed one at a time.
          </Empty>
        ) : (
          <ul className="plain-list">
            {report.graph.cycles.slice(0, 20).map((c) => (
              <li key={`${c.scope}-${c.members.join(",")}`}>
                <Chip tone="muted">{c.scope}</Chip>{" "}
                <Chip tone="muted">{c.typeOnly ? "type-only" : "runtime"}</Chip>{" "}
                <span className="mono small">
                  {c.members
                    .slice(0, 5)
                    .map((m) =>
                      c.scope === "module"
                        ? (moduleById.get(m)?.path ?? m)
                        : (report.graph.nodes.find((n) => n.id === m)?.path ?? m),
                    )
                    .join(", ")}
                  {c.members.length > 5 ? ` and ${c.members.length - 5} more` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
