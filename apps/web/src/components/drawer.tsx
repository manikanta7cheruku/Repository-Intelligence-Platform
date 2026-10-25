"use client";

import { impactOf } from "@repolens/core/browser";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { dec, num, pct } from "@/lib/format";
import { entry } from "@/lib/glossary";
import { Icon } from "./icons";
import { useReport } from "./report-context";
import { Bar, Chip, ConfidenceChip, SeverityBadge } from "./ui";

/** The evidence drawer: opens on any selection and shows evidence, explanation, impact and remediation. */
export function Drawer() {
  const { selection, select } = useReport();
  const ref = useRef<HTMLElement>(null);
  const open = selection !== null;

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    document.addEventListener("keydown", key);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", key);
  }, [open, select]);

  if (!selection) return null;
  return (
    <>
      <button
        type="button"
        className="scrim"
        aria-label="Close details"
        onClick={() => select(null)}
      />
      <aside className="drawer" ref={ref} tabIndex={-1} aria-label="Details">
        <div className="drawer-grip" aria-hidden="true" />
        <button
          type="button"
          className="icon-btn drawer-close"
          aria-label="Close details"
          onClick={() => select(null)}
        >
          <Icon name="close" />
        </button>
        <DrawerBody />
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="d-sec">
      <h3 className="d-h">{title}</h3>
      {children}
    </section>
  );
}

function DrawerBody() {
  const ctx = useReport();
  const { selection, report, findingById, moduleById, select, reverse } = ctx;

  if (selection?.kind === "finding") {
    const f = findingById.get(selection.id);
    if (!f) return <p>This finding is not in the report.</p>;
    return (
      <div className="d-body">
        <div className="d-meta">
          <SeverityBadge severity={f.severity} />
          <ConfidenceChip value={f.confidence} />
          <Chip tone="muted">{f.origin}</Chip>
          {f.classification ? <Chip tone="muted">{f.classification}</Chip> : null}
        </div>
        <h2 className="d-title">{f.title}</h2>
        <p>{f.explanation}</p>
        {f.evidence.length > 0 ? (
          <Section title="Evidence">
            <ul className="plain-list">
              {f.evidence.map((e) => (
                <li key={`${e.kind}-${e.refs.join(",")}-${e.note}`}>
                  <span className="chip chip-muted">{e.kind}</span>{" "}
                  {e.note ? <span>{e.note}. </span> : null}
                  {e.refs.slice(0, 8).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="path-link"
                      onClick={() => select({ kind: "file", path: r })}
                    >
                      {r}
                    </button>
                  ))}
                  {e.refs.length > 8 ? (
                    <span className="muted"> and {e.refs.length - 8} more</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {f.locations.length > 0 ? (
          <Section title="Locations">
            <ul className="plain-list mono small">
              {f.locations.slice(0, 12).map((l) => (
                <li key={`${l.path}:${l.startLine}`}>
                  {l.path}
                  {l.startLine ? `:${l.startLine}` : ""}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title="What to do">
          <p>{f.remediation}</p>
        </Section>
        {f.limitations.length > 0 ? (
          <Section title="Limits of this finding">
            <ul className="plain-list">
              {f.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Section>
        ) : null}
        <p className="d-id mono small muted">{f.ruleId}</p>
      </div>
    );
  }

  if (selection?.kind === "file" || selection?.kind === "risk") {
    const path = selection.path;
    const fr = report.files.find((x) => x.path === path);
    const node = ctx.nodeByPath.get(path);
    const impact = impactOf(reverse, path);
    const risk = report.risk.files.find((r) => r.path === path);
    const related = report.findings.filter((f) => f.locations.some((l) => l.path === path));
    return (
      <div className="d-body">
        <div className="d-meta">
          <Chip tone="muted">{fr?.kind ?? "file"}</Chip>
          {fr?.language ? <Chip tone="muted">{fr.language}</Chip> : null}
        </div>
        <h2 className="d-title mono">{path}</h2>
        <dl className="kv">
          <dt>Code lines</dt>
          <dd className="num">{num(fr?.codeLines)}</dd>
          <dt>Imported by</dt>
          <dd className="num">{node ? num(node.fanIn) : "n/a"}</dd>
          <dt>Imports</dt>
          <dd className="num">{node ? num(node.fanOut) : "n/a"}</dd>
          <dt>Module</dt>
          <dd className="mono small">{node ? ctx.modulePathOf(node.moduleId) : "n/a"}</dd>
        </dl>
        {impact ? (
          <Section title="What could break if this file changes">
            <p>
              <strong className="num">{num(impact.transitiveDependents)}</strong> files depend on
              it, <strong className="num">{num(impact.directDependents)}</strong> directly. The
              longest chain is <span className="num">{impact.maxDepth}</span> steps, across{" "}
              <span className="num">{impact.modulesAffected.length}</span> modules and{" "}
              <span className="num">{impact.entrypointsAffected.length}</span> entrypoints.
            </p>
            <Link
              className="btn btn-sm"
              href={`/r/${ctx.id}/impact?file=${encodeURIComponent(path)}`}
              onClick={() => select(null)}
            >
              Open impact graph
            </Link>
          </Section>
        ) : (
          <Section title="What could break if this file changes">
            <p className="muted">
              This file is not in the dependency graph (tests, docs or unsupported language).
            </p>
          </Section>
        )}
        {risk ? (
          <Section title={`Risk ${Math.round(risk.risk)} of 100`}>
            <p>{risk.explanation}</p>
            <FactorBars factors={risk.factors} />
          </Section>
        ) : null}
        {related.length > 0 ? (
          <Section title={`Findings here (${related.length})`}>
            <ul className="plain-list">
              {related.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="path-link"
                    onClick={() => select({ kind: "finding", id: f.id })}
                  >
                    {f.title}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    );
  }

  if (selection?.kind === "module") {
    const m = moduleById.get(selection.id);
    if (!m) return <p>This module is not in the report.</p>;
    const lvl = report.graph.levels.find((l) => l.moduleId === m.id);
    const dependents = report.graph.moduleEdges.filter((e) => e.to === m.id);
    const deps = report.graph.moduleEdges.filter((e) => e.from === m.id);
    const cyc = report.graph.cycles.filter((c) => c.scope === "module" && c.members.includes(m.id));
    const files = report.graph.nodes
      .filter((n) => n.moduleId === m.id)
      .sort((a, b) => b.fanIn - a.fanIn);
    return (
      <div className="d-body">
        <div className="d-meta">
          <Chip tone="muted">{m.kind}</Chip>
          {cyc.length > 0 ? <Chip>In a cycle</Chip> : null}
        </div>
        <h2 className="d-title mono">{m.path}</h2>
        <dl className="kv">
          <dt>Files</dt>
          <dd className="num">{num(m.fileCount)}</dd>
          <dt>Code lines</dt>
          <dd className="num">{num(m.loc)}</dd>
          <dt>Level</dt>
          <dd className="num">{lvl ? lvl.level : "n/a"}</dd>
          <dt>Imported by modules</dt>
          <dd className="num">{num(m.fanIn)}</dd>
          <dt>Imports modules</dt>
          <dd className="num">{num(m.fanOut)}</dd>
          <dt>Instability</dt>
          <dd className="num">{dec(m.instability)}</dd>
        </dl>
        <Link
          className="btn btn-sm"
          href={`/r/${ctx.id}/structure?module=${encodeURIComponent(m.id)}`}
          onClick={() => select(null)}
        >
          Show its files on the map
        </Link>
        <Section title={`Depends on (${deps.length})`}>
          <ul className="plain-list mono small">
            {deps.map((e) => (
              <li key={e.to}>
                <button
                  type="button"
                  className="path-link"
                  onClick={() => select({ kind: "module", id: e.to })}
                >
                  {ctx.modulePathOf(e.to)}
                </button>{" "}
                <span className="muted">{e.weight} imports</span>
              </li>
            ))}
            {deps.length === 0 ? <li className="muted">Nothing.</li> : null}
          </ul>
        </Section>
        <Section title={`Used by (${dependents.length})`}>
          <ul className="plain-list mono small">
            {dependents.map((e) => (
              <li key={e.from}>
                <button
                  type="button"
                  className="path-link"
                  onClick={() => select({ kind: "module", id: e.from })}
                >
                  {ctx.modulePathOf(e.from)}
                </button>{" "}
                <span className="muted">{e.weight} imports</span>
              </li>
            ))}
            {dependents.length === 0 ? <li className="muted">Nothing.</li> : null}
          </ul>
        </Section>
        <Section title="Most imported files">
          <ul className="plain-list mono small">
            {files.slice(0, 6).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="path-link"
                  onClick={() => select({ kind: "file", path: n.path })}
                >
                  {n.path}
                </button>{" "}
                <span className="muted">imported by {n.fanIn}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    );
  }

  if (selection?.kind === "term") {
    const e = entry(selection.id);
    if (!e) return <p>Unknown term.</p>;
    return (
      <div className="d-body">
        <div className="d-meta">
          <Chip tone="muted">{e.category}</Chip>
        </div>
        <h2 className="d-title">{e.label}</h2>
        <p>{e.plain}</p>
        <Section title="Technically">
          <p>{e.technical}</p>
        </Section>
        <Section title="Why it matters">
          <p>{e.why}</p>
        </Section>
        <Section title="How it is calculated">
          <p>{e.calculation}</p>
        </Section>
        <Section title="How to improve">
          <p>{e.improve}</p>
        </Section>
      </div>
    );
  }
  return null;
}

export function FactorBars({
  factors,
}: {
  factors: { name: string; value: number | null; percentile: number | null; note: string }[];
}) {
  return (
    <ul className="factors">
      {factors.map((f) => (
        <li key={f.name}>
          <div className="factor-row">
            <span>{f.name.replace(/-/g, " ")}</span>
            <span className="num muted">
              {f.percentile === null ? "not available" : `${pct(f.percentile)} percentile`}
            </span>
          </div>
          {f.percentile !== null ? (
            <Bar value={f.percentile * 100} label={`${f.name} percentile ${pct(f.percentile)}`} />
          ) : null}
          <div className="small muted">{f.note}</div>
        </li>
      ))}
    </ul>
  );
}
