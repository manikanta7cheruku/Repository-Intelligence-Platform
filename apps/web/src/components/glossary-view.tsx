"use client";

import { GLOSSARY, GLOSSARY_VERSION } from "@repolens/core/browser";
import { useEffect, useMemo, useState } from "react";

const CATEGORY_LABEL: Record<string, string> = {
  dimension: "Scores",
  "score-input": "Score inputs",
  concept: "Concepts",
  finding: "Findings",
  metric: "Metrics",
  status: "Status",
};

export function GlossaryView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setTarget(decodeURIComponent(window.location.hash.slice(1)) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [target]);

  const cats = useMemo(() => ["all", ...Array.from(new Set(GLOSSARY.map((g) => g.category)))], []);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return GLOSSARY.filter(
      (g) =>
        (cat === "all" || g.category === cat) &&
        (!t || `${g.label} ${g.plain} ${g.technical}`.toLowerCase().includes(t)),
    ).sort((a, b) => a.label.localeCompare(b.label));
  }, [q, cat]);

  return (
    <div className="gloss">
      <div className="gloss-tools">
        <input
          className="input"
          type="search"
          placeholder="Search terms"
          aria-label="Search the glossary"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="filters" role="group" aria-label="Filter by category">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={`filter${cat === c ? " is-on" : ""}`}
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c === "all" ? "All" : (CATEGORY_LABEL[c] ?? c)}
            </button>
          ))}
        </div>
        <p className="small muted num">
          {rows.length} of {GLOSSARY.length} terms. Glossary version {GLOSSARY_VERSION}.
        </p>
      </div>
      <ul className="gloss-list">
        {rows.map((g) => (
          <li key={g.id} id={g.id} className={target === g.id ? "is-target" : ""}>
            <h2 className="h3">
              {g.label}{" "}
              <a className="anchor" href={`#${g.id}`} aria-label={`Link to ${g.label}`}>
                #
              </a>
            </h2>
            <p className="gloss-plain">{g.plain}</p>
            <dl className="gloss-dl">
              <dt>Technically</dt>
              <dd>{g.technical}</dd>
              <dt>Why it matters</dt>
              <dd>{g.why}</dd>
              <dt>How it is calculated</dt>
              <dd>{g.calculation}</dd>
              <dt>How to improve</dt>
              <dd>{g.improve}</dd>
            </dl>
          </li>
        ))}
        {rows.length === 0 ? <li className="muted">No term matches.</li> : null}
      </ul>
    </div>
  );
}
