export interface SectionDef {
  slug: string;
  label: string;
  icon: string;
  summary: string;
}

/** The report sections follow the questions people ask, in order. */
export const SECTIONS: SectionDef[] = [
  {
    slug: "briefing",
    label: "Briefing",
    icon: "briefing",
    summary: "What this is and how reliable the analysis is",
  },
  { slug: "priorities", label: "Priorities", icon: "priorities", summary: "What to fix first" },
  {
    slug: "structure",
    label: "Structure",
    icon: "structure",
    summary: "Modules, dependencies and cycles",
  },
  {
    slug: "impact",
    label: "Impact",
    icon: "impact",
    summary: "What could break if a file changes",
  },
  { slug: "risk", label: "Risk", icon: "risk", summary: "Files that are costly to change" },
  {
    slug: "quality",
    label: "Quality",
    icon: "quality",
    summary: "Complexity, size and duplication",
  },
  {
    slug: "security",
    label: "Security",
    icon: "security",
    summary: "Vulnerabilities, secrets and workflows",
  },
  {
    slug: "practices",
    label: "Practices",
    icon: "practices",
    summary: "Tests, CI and documentation",
  },
  {
    slug: "history",
    label: "History",
    icon: "history",
    summary: "Contributors, hotspots and habits",
  },
  { slug: "rules", label: "Rules", icon: "rules", summary: "Architecture rules and violations" },
  { slug: "compare", label: "Compare", icon: "compare", summary: "Two reports side by side" },
  { slug: "export", label: "Export", icon: "export", summary: "Download the report and diagrams" },
];

export const MOBILE_TABS = ["briefing", "structure", "impact", "risk"];
