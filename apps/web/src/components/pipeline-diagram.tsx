"use client";

import type { GEdge, GNode } from "@/lib/layout";
import { fileStem } from "@/lib/svg";
import { ExportMenu } from "./export-menu";
import { GraphLegend, graphExportSvg, LayeredGraph } from "./layered-graph";

const NODES: GNode[] = [
  { id: "acquire", label: "Acquire", sub: "Folder or GitHub archive, bounded", size: 9 },
  { id: "classify", label: "Classify", sub: "Language, kind, line counts", size: 8 },
  { id: "analyze", label: "Analyze code", sub: "Imports, symbols, functions", size: 7 },
  { id: "graph", label: "Graph", sub: "Modules, cycles, blast radius", size: 6 },
  { id: "metrics", label: "Metrics", sub: "Complexity, duplication", size: 5 },
  { id: "rules", label: "Rules", sub: "Layers, limits, baselines", size: 4 },
  { id: "history", label: "History", sub: "Git or GitHub API", size: 3 },
  { id: "security", label: "Security", sub: "OSV, secrets, workflows", size: 2 },
  { id: "practices", label: "Practices", sub: "Tests, CI, documentation", size: 1 },
  { id: "scoring", label: "Findings and scores", sub: "Evidence, inputs, curves", size: 0 },
  { id: "report", label: "Report", sub: "JSON is the source of truth", size: 0, kind: "target" },
];
const EDGES: GEdge[] = [
  ["acquire", "classify"],
  ["acquire", "history"],
  ["classify", "analyze"],
  ["classify", "security"],
  ["classify", "practices"],
  ["analyze", "graph"],
  ["analyze", "metrics"],
  ["graph", "rules"],
  ["rules", "scoring"],
  ["metrics", "scoring"],
  ["history", "scoring"],
  ["security", "scoring"],
  ["practices", "scoring"],
  ["scoring", "report"],
].map(([from, to]) => ({ from: from as string, to: to as string }));

export function PipelineDiagram() {
  const meta = {
    title: "RIP analysis pipeline",
    repo: "Repository Intelligence Platform",
    commit: null,
    date: new Date().toISOString().slice(0, 10),
    tool: "Architecture overview",
    legend: [
      "Arrows show the order of work",
      "Each stage fails on its own and is reported as not assessed",
    ],
  };
  return (
    <figure className="figure">
      <div className="figure-head">
        <figcaption className="h4">Analysis pipeline</figcaption>
        <ExportMenu
          source={{
            stem: fileStem("rip", "pipeline"),
            title: meta.title,
            svg: () => graphExportSvg(NODES, EDGES, null, meta),
            data: () => ({ nodes: NODES, edges: EDGES }),
          }}
        />
      </div>
      <LayeredGraph nodes={NODES} edges={EDGES} label="Analysis pipeline" height={440} />
      <GraphLegend
        items={[
          { swatch: "out", text: "Hover a stage to see its inputs and outputs" },
          { swatch: "target", text: "Final output" },
        ]}
      />
    </figure>
  );
}
