"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { allTerms } from "@/lib/glossary";
import { SECTIONS } from "@/lib/sections";
import { Icon } from "./icons";
import { useReport } from "./report-context";

interface Item {
  key: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Jump to any section, file, finding or glossary term. Opens with Ctrl or Cmd K, or the search button. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { id, report, select } = useReport();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const go = (fn: () => void) => () => {
      onClose();
      fn();
    };
    const sections: Item[] = SECTIONS.filter(
      (s) => !term || s.label.toLowerCase().includes(term),
    ).map((s) => ({
      key: `s-${s.slug}`,
      group: "Sections",
      label: s.label,
      hint: s.summary,
      run: go(() => router.push(`/r/${id}/${s.slug}`)),
    }));
    if (!term) return sections;
    const files: Item[] = report.graph.nodes
      .filter((n) => n.path.toLowerCase().includes(term))
      .slice(0, 8)
      .map((n) => ({
        key: `f-${n.id}`,
        group: "Files",
        label: n.path,
        hint: `imported by ${n.fanIn}`,
        run: go(() => select({ kind: "file", path: n.path })),
      }));
    const findings: Item[] = report.findings
      .filter((f) => f.title.toLowerCase().includes(term))
      .slice(0, 6)
      .map((f) => ({
        key: `i-${f.id}`,
        group: "Findings",
        label: f.title,
        hint: f.severity,
        run: go(() => select({ kind: "finding", id: f.id })),
      }));
    const terms: Item[] = allTerms()
      .filter((t) => t.label.toLowerCase().includes(term))
      .slice(0, 5)
      .map((t) => ({
        key: `t-${t.id}`,
        group: "Glossary",
        label: t.label,
        hint: t.plain.slice(0, 70),
        run: go(() => select({ kind: "term", id: t.id })),
      }));
    return [...sections, ...files, ...findings, ...terms];
  }, [q, report, id, router, select, onClose]);

  useEffect(() => setCursor(0), []);

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="palette-wrap" role="presentation">
      <button type="button" className="scrim" aria-label="Close search" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search the report">
        <div className="palette-in">
          <Icon name="search" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder="Search sections, files, findings and terms"
            aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(items.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") items[cursor]?.run();
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list">
          {items.length === 0 ? <li className="palette-empty">Nothing matches.</li> : null}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.key}>
                {head ? <div className="palette-group">{head}</div> : null}
                <button
                  type="button"
                  className={`palette-item${i === cursor ? " is-on" : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={it.run}
                >
                  <span className="palette-label">{it.label}</span>
                  {it.hint ? <span className="palette-hint">{it.hint}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
