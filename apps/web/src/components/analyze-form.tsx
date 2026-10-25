"use client";

import { type Report, upgradeReport, validateReport } from "@repolens/core/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { listReports, type StoredMeta, saveReport } from "@/lib/store";

const STAGES: { id: string; label: string }[] = [
  { id: "acquiring", label: "Fetching the repository" },
  { id: "detecting", label: "Detecting files and languages" },
  { id: "analyzing", label: "Reading imports and functions" },
  { id: "graph", label: "Building the dependency graph" },
  { id: "metrics", label: "Measuring size and complexity" },
  { id: "rules", label: "Checking architecture rules" },
  { id: "history", label: "Reading history" },
  { id: "security", label: "Checking security signals" },
  { id: "practices", label: "Checking practices" },
  { id: "scoring", label: "Scoring" },
  { id: "reporting", label: "Writing the report" },
];

type Phase = "idle" | "running" | "error";

export function AnalyzeForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [tests, setTests] = useState(true);
  const [history, setHistory] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [recent, setRecent] = useState<StoredMeta[]>([]);
  const ctl = useRef<AbortController | null>(null);
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    listReports()
      .then((r) => setRecent(r.slice(0, 5)))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  const finish = async (report: Report) => {
    const id = await saveReport(report);
    router.push(`/r/${id}/briefing`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone([]);
    setStage("acquiring");
    setPhase("running");
    started.current = Date.now();
    const c = new AbortController();
    ctl.current = c;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), includeTests: tests, history }),
        signal: c.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `The server answered ${res.status}.`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let nl = buf.indexOf("\n");
        while (nl >= 0) {
          const row = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          nl = buf.indexOf("\n");
          if (!row) continue;
          const msg = JSON.parse(row) as { stage?: string; error?: string; report?: Report };
          if (msg.error) throw new Error(msg.error);
          if (msg.stage) {
            setStage((prev) => {
              if (prev && prev !== msg.stage) setDone((d) => (d.includes(prev) ? d : [...d, prev]));
              return msg.stage as string;
            });
          }
          if (msg.report) {
            await finish(msg.report);
            return;
          }
        }
      }
      throw new Error("The analysis ended without a report.");
    } catch (err) {
      if (c.signal.aborted) {
        setPhase("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "The analysis failed.");
      setPhase("error");
    }
  };

  const openFile = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    try {
      let data = JSON.parse(await f.text()) as unknown;
      const up = upgradeReport(data);
      if (!up) {
        setError(
          "That report is from a much older version of the tool. Analyze the repository again.",
        );
        return;
      }
      data = up.report;
      const v = validateReport(data);
      if (!v.valid) {
        setError(
          `That file is not a valid report (${v.issues[0]?.path ?? ""} ${v.issues[0]?.message ?? ""}). Regenerate it with the current CLI.`,
        );
        setPhase("error");
        return;
      }
      await finish(data as Report);
    } catch {
      setError("That file is not JSON.");
      setPhase("error");
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void openFile(e.dataTransfer.files[0]);
  };

  if (phase === "running")
    return (
      <div className="progress" role="status" aria-live="polite">
        <div className="progress-head">
          <b>Analyzing {url.replace(/^https:\/\/github\.com\//, "")}</b>
          <span className="small muted num">{elapsed} s</span>
        </div>
        <ol className="stages">
          {STAGES.map((s) => (
            <li
              key={s.id}
              className={done.includes(s.id) ? "is-done" : stage === s.id ? "is-now" : ""}
            >
              <span className="stage-mark" aria-hidden="true" />
              {s.label}
              {done.includes(s.id) ? (
                <span className="sr-only"> done</span>
              ) : stage === s.id ? (
                <span className="sr-only"> in progress</span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="small muted">
          Large repositories can take up to a minute. Nothing is stored on the server.
        </p>
        <button type="button" className="btn" onClick={() => ctl.current?.abort()}>
          Cancel
        </button>
      </div>
    );

  return (
    <div className="analyze">
      <form onSubmit={submit} className="analyze-form">
        <label htmlFor="repo-url" className="label">
          GitHub repository
        </label>
        <div className="analyze-row">
          <input
            id="repo-url"
            className="input input-lg"
            type="url"
            inputMode="url"
            required
            placeholder="https://github.com/owner/repository"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-primary btn-lg">
            Analyze
          </button>
        </div>
        <div className="analyze-opts">
          <label className="check">
            <input type="checkbox" checked={tests} onChange={(e) => setTests(e.target.checked)} />
            Include tests
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />
            Recent commit history
          </label>
          <span className="small muted">
            Public repositories only. Add /tree/branch to the URL for a branch.
          </span>
        </div>
      </form>

      <div
        className={`drop${drag ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        role="group"
        aria-label="Open a local report"
      >
        <div>
          <b>Open a report.json</b>
          <p className="small muted">
            Created by the CLI with repolens analyze . -f json. It is read in this browser and never
            uploaded.
          </p>
        </div>
        <label className="btn">
          Choose file
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void openFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <div className="recent">
          <h2 className="h4">Reports in this browser</h2>
          <ul className="plain-list">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${r.id}/briefing`}>{r.name}</Link>{" "}
                <span className="muted small mono">{r.commit?.slice(0, 7) ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
