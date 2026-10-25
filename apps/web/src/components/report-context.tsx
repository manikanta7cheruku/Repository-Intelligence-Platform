"use client";

import {
  buildReverseIndex,
  type Finding,
  type ModuleRecord,
  type Report,
  type ReverseIndex,
  upgradeReport,
  validateReport,
} from "@repolens/core/browser";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadReport } from "@/lib/store";

export type Selection =
  | { kind: "finding"; id: string }
  | { kind: "file"; path: string }
  | { kind: "module"; id: string }
  | { kind: "risk"; path: string }
  | { kind: "score"; dimension: string }
  | { kind: "term"; id: string }
  | null;

interface Ctx {
  id: string;
  report: Report;
  findingById: Map<string, Finding>;
  moduleById: Map<string, ModuleRecord>;
  modulePathOf: (moduleId: string) => string;
  nodeByPath: Map<string, Report["graph"]["nodes"][number]>;
  reverse: ReverseIndex;
  selection: Selection;
  select: (s: Selection) => void;
}

const ReportCtx = createContext<Ctx | null>(null);

export function useReport(): Ctx {
  const c = useContext(ReportCtx);
  if (!c) throw new Error("useReport must be used inside ReportLoader");
  return c;
}

type State =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "invalid"; issues: string[] }
  | { phase: "ready"; report: Report };

/** Loads a report from the sample file or from this browser's IndexedDB, validates it, and provides it. */
export function ReportLoader({ id, children }: { id: string; children: ReactNode }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    (async () => {
      try {
        let data: unknown;
        if (id === "sample") {
          const res = await fetch("/sample/report.json");
          data = res.ok ? await res.json() : null;
        } else {
          data = await loadReport(id);
        }
        if (cancelled) return;
        if (!data) return setState({ phase: "missing" });
        const upgraded = upgradeReport(data);
        if (!upgraded)
          return setState({
            phase: "invalid",
            issues: [
              "This report was made by a much older version of the tool and cannot be opened. Analyze the repository again.",
            ],
          });
        data = upgraded.report;
        const check = validateReport(data);
        if (!check.valid)
          return setState({
            phase: "invalid",
            issues: check.issues.slice(0, 8).map((e) => `${e.path}: ${e.message}`),
          });
        setState({ phase: "ready", report: data as Report });
      } catch {
        if (!cancelled) setState({ phase: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const select = useCallback((s: Selection) => setSelection(s), []);

  const value = useMemo<Ctx | null>(() => {
    if (state.phase !== "ready") return null;
    const r = state.report;
    const moduleById = new Map(r.graph.modules.map((m) => [m.id, m]));
    return {
      id,
      report: r,
      findingById: new Map(r.findings.map((f) => [f.id, f])),
      moduleById,
      modulePathOf: (mid) => moduleById.get(mid)?.path ?? mid,
      nodeByPath: new Map(r.graph.nodes.map((n) => [n.path, n])),
      reverse: buildReverseIndex(
        r.graph,
        r.detection.entrypoints.map((e) => e.path),
      ),
      selection,
      select,
    };
  }, [state, id, selection, select]);

  if (state.phase === "loading")
    return (
      <div className="state" role="status" aria-live="polite">
        <div className="skeleton sk-title" />
        <div className="skeleton sk-line" />
        <div className="skeleton sk-block" />
        <span className="sr-only">Loading report</span>
      </div>
    );
  if (state.phase === "missing")
    return (
      <div className="state">
        <h1 className="h1">This report is not in this browser</h1>
        <p className="lede">
          Reports are kept only in the browser that created them. Analyze the repository again or
          open the report.json file you downloaded.
        </p>
        <a className="btn btn-primary" href="/">
          Back to start
        </a>
      </div>
    );
  if (state.phase === "invalid")
    return (
      <div className="state">
        <h1 className="h1">This file is not a valid report</h1>
        <p className="lede">
          It does not match schema 0.4.0 and could not be upgraded. Analyze the repository again.
        </p>
        <ul className="plain-list mono small">
          {state.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <a className="btn btn-primary" href="/">
          Back to start
        </a>
      </div>
    );
  return <ReportCtx.Provider value={value as Ctx}>{children}</ReportCtx.Provider>;
}
