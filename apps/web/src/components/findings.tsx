"use client";

import type { Finding, Severity } from "@repolens/core/browser";
import { useMemo, useState } from "react";
import { SEVERITY_ORDER, severityLabel } from "@/lib/format";
import { DataTable } from "./data-table";
import { useReport } from "./report-context";
import { Chip, SeverityBadge } from "./ui";

/** Findings with a severity filter. Selecting a row opens the evidence drawer. */
export function FindingsList({
  items,
  empty = "No findings in this area.",
}: {
  items: Finding[];
  empty?: string;
}) {
  const { select } = useReport();
  const [sev, setSev] = useState<Severity | "all">("all");
  const counts = useMemo(() => {
    const m = new Map<Severity, number>();
    for (const f of items) m.set(f.severity, (m.get(f.severity) ?? 0) + 1);
    return m;
  }, [items]);
  const rows = sev === "all" ? items : items.filter((f) => f.severity === sev);
  return (
    <div>
      {items.length > 0 ? (
        <div className="filters" role="group" aria-label="Filter by severity">
          <button
            type="button"
            className={`filter${sev === "all" ? " is-on" : ""}`}
            aria-pressed={sev === "all"}
            onClick={() => setSev("all")}
          >
            All <span className="num">{items.length}</span>
          </button>
          {SEVERITY_ORDER.filter((s) => counts.has(s)).map((s) => (
            <button
              key={s}
              type="button"
              className={`filter${sev === s ? " is-on" : ""}`}
              aria-pressed={sev === s}
              onClick={() => setSev(s)}
            >
              {severityLabel[s]} <span className="num">{counts.get(s)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <DataTable
        caption="Findings"
        rows={rows}
        empty={empty}
        rowKey={(f) => f.id}
        onRow={(f) => select({ kind: "finding", id: f.id })}
        initialSort={{ key: "severity", dir: "desc" }}
        columns={[
          {
            key: "title",
            label: "Finding",
            render: (f) => <span className="cell-title">{f.title}</span>,
            sort: (f) => f.title,
          },
          {
            key: "severity",
            label: "Severity",
            render: (f) => <SeverityBadge severity={f.severity} />,
            sort: (f) => SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(f.severity),
          },
          {
            key: "confidence",
            label: "Confidence",
            render: (f) => <Chip tone="muted">{f.confidence}</Chip>,
            secondary: true,
          },
          {
            key: "where",
            label: "Where",
            render: (f) => (
              <span className="mono small">{f.locations[0]?.path ?? "repository"}</span>
            ),
            secondary: true,
          },
        ]}
      />
    </div>
  );
}
