"use client";

import { Briefing } from "./sections/briefing";
import { Priorities, Quality, Risk, Security } from "./sections/findings-pages";
import { Impact } from "./sections/impact";
import { History, Practices } from "./sections/practices-history";
import { Compare, ExportPage, Rules } from "./sections/rules-compare-export";
import { Structure } from "./sections/structure";

export function SectionView({ slug }: { slug: string }) {
  switch (slug) {
    case "briefing":
      return <Briefing />;
    case "priorities":
      return <Priorities />;
    case "structure":
      return <Structure />;
    case "impact":
      return <Impact />;
    case "risk":
      return <Risk />;
    case "quality":
      return <Quality />;
    case "security":
      return <Security />;
    case "practices":
      return <Practices />;
    case "history":
      return <History />;
    case "rules":
      return <Rules />;
    case "compare":
      return <Compare />;
    case "export":
      return <ExportPage />;
    default:
      return null;
  }
}
