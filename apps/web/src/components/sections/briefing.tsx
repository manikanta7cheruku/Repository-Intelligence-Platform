"use client";

import { DIMENSION_LABELS, type ScoreRecord } from "@repolens/core/browser";
import Link from "next/link";
import { useState } from "react";
import { CurveSpark } from "@/components/charts";
import { useReport } from "@/components/report-context";
import { Bar, Card, ConfidenceChip, NotAssessed, PageHead, Stat, Term } from "@/components/ui";
import { dateText, dec, num, pct, shortSha } from "@/lib/format";

export function Briefing() {
  const { id, report, select } = useReport();
  const es = report.executiveSummary;
  const r = report.repository;
  const fixFirst = report.recommendations.slice(0, 3);

  return (
    <>
      <PageHead
        title={r.name}
        lede={es.headline}
        actions={
          <span className="meta-line mono small">
            {shortSha(r.commitSha)} | {dateText(report.reproducibility.finishedAt)}
          </span>
        }
      />

      <div className="grid-stats">
        <Stat
          label="Files"
          value={num(r.totalFiles)}
          note={`${num(r.productionFiles)} production, ${num(r.testFiles)} test`}
        />
        <Stat
          label="Code lines"
          value={num(report.metrics.totals.codeLines)}
          note={`${num(report.metrics.functionCount)} functions`}
        />
        <Stat
          label="Modules"
          value={num(report.graph.modules.length)}
          note={`${num(report.graph.edges.length)} file dependencies`}
        />
        <Stat
          label={<Term id="cycle">Cycles</Term>}
          value={num(report.graph.cycles.length)}
          note={report.graph.cycles.length === 0 ? "None found" : "See Structure"}
        />
      </div>

      <div className="cols-2">
        <Card title="Fix first">
          {fixFirst.length === 0 ? (
            <p className="muted">No recommendations were produced for this report.</p>
          ) : (
            <ol className="fixlist">
              {fixFirst.map((x) => (
                <li key={x.rank}>
                  <div>
                    <b>{x.title}</b>
                    <p className="small muted">{x.rationale.split(". ")[0]}</p>
                  </div>
                  {x.effort ? <span className="chip chip-muted">Effort {x.effort}</span> : null}
                </li>
              ))}
            </ol>
          )}
          <Link className="textlink" href={`/r/${id}/priorities`}>
            All priorities
          </Link>
        </Card>
        <Card title="Reading this report">
          <ul className="plain-list">
            {es.overview.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Scores and the proof behind them" id="scores">
        <p className="small muted lede-sm">
          Every score is a weighted average of named inputs. Open a score to see each input, the
          curve that turned the raw value into points, and the files behind it. A missing input is
          excluded, never counted as zero.
        </p>
        <div className="scores">
          {report.scores.map((s) => (
            <ScoreRow key={s.dimension} score={s} />
          ))}
        </div>
      </Card>

      <div className="cols-2">
        <Card title="What looks good">
          {es.strengths.length === 0 ? (
            <p className="muted">Nothing stood out as a strength.</p>
          ) : (
            <ul className="plain-list">
              {es.strengths.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="What needs attention">
          {es.concerns.length === 0 ? (
            <p className="muted">No concerns were raised by the checks that ran.</p>
          ) : (
            <ul className="plain-list">
              {es.concerns.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="How reliable is this analysis" id="reliability">
        <div className="rel">
          <div>
            <h3 className="h4">Language coverage</h3>
            <ul className="plain-list">
              {report.coverage.map((c) => (
                <li key={`${c.analyzerId}-${c.language}`} className="rel-row">
                  <span>
                    <b>{c.language}</b>{" "}
                    <span className="muted small">support level {c.supportLevel}</span>
                  </span>
                  <span className="num">
                    {c.filesAnalyzed} of {c.filesEligible}
                  </span>
                </li>
              ))}
            </ul>
            <p className="small muted">
              <Term id="support-level">Support level</Term> 3 means the code is parsed. Level 2
              reads imports as text. Level 1 means detection and line counts only.
            </p>
          </div>
          <div>
            <h3 className="h4">Limits you should know</h3>
            <ul className="plain-list small">
              {report.limitations.slice(0, 6).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <button
              type="button"
              className="textlink"
              onClick={() => select({ kind: "term", id: "partial-report" })}
            >
              What a partial report means
            </button>
          </div>
        </div>
      </Card>

      <div className="entry-grid">
        {[
          ["structure", "Structure", "See how modules depend on each other."],
          ["impact", "Impact", "Pick a file and see what it could break."],
          ["risk", "Risk", "Find the files that are costly to change."],
        ].map(([slug, title, text]) => (
          <Link key={slug} href={`/r/${id}/${slug}`} className="entry">
            <b>{title}</b>
            <span>{text}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function ScoreRow({ score }: { score: ScoreRecord }) {
  const [open, setOpen] = useState(false);
  const { select } = useReport();
  const label = DIMENSION_LABELS[score.dimension] ?? score.dimension;
  const assessed = score.state === "assessed" && score.value !== null;
  const panel = `proof-${score.dimension}`;
  return (
    <div className={`score${open ? " is-open" : ""}`}>
      <div className="score-main">
        <div className="score-name">
          <Term id={score.dimension}>{label}</Term>
          {assessed ? <ConfidenceChip value={score.confidence} /> : null}
        </div>
        {assessed ? (
          <>
            <div className="score-val num">{score.value}</div>
            <Bar value={score.value ?? 0} label={`${label} score ${score.value} of 100`} />
          </>
        ) : (
          <NotAssessed reason={score.reason} />
        )}
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide proof" : "Show proof"}
        </button>
      </div>
      {open ? (
        <div className="proof" id={panel}>
          <p className="proof-basis">{score.basis}</p>
          <div className="table-wrap">
            <table className="table proof-table">
              <caption className="sr-only">Inputs of {label}</caption>
              <thead>
                <tr>
                  <th scope="col">Input</th>
                  <th scope="col" className="right">
                    Raw
                  </th>
                  <th scope="col">Curve</th>
                  <th scope="col" className="right">
                    Score
                  </th>
                  <th scope="col" className="right">
                    Weight
                  </th>
                  <th scope="col" className="right">
                    Adds
                  </th>
                  <th scope="col" className="right">
                    To gain
                  </th>
                </tr>
              </thead>
              <tbody>
                {score.inputs.map((i) => (
                  <tr key={i.name} className={i.available ? "" : "is-off"}>
                    <td data-label="Input">
                      <div className="cell-title">
                        <Term id={i.name}>{i.name.replace(/-/g, " ")}</Term>
                      </div>
                      <div className="small muted">{i.description}</div>
                      <div className="small">{i.available ? i.note : `Unavailable: ${i.note}`}</div>
                      {i.evidence.length > 0 ? (
                        <div className="evid">
                          {i.evidence.map((e) => (
                            <button
                              key={e}
                              type="button"
                              className="path-link"
                              onClick={() =>
                                e.includes("/") || e.includes(".")
                                  ? select({ kind: "file", path: e })
                                  : undefined
                              }
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Raw" className="right num">
                      {i.raw === null ? "n/a" : dec(i.raw, i.raw < 10 ? 3 : 1)}
                    </td>
                    <td data-label="Curve">
                      <CurveSpark curve={i.curve} raw={i.raw} label={`Curve of ${i.name}`} />
                      <div className="small muted">
                        {i.origin === "provisional" ? "Provisional curve" : "Convention"}
                      </div>
                    </td>
                    <td data-label="Score" className="right num">
                      {i.normalized === null ? "n/a" : Math.round(i.normalized)}
                    </td>
                    <td data-label="Weight" className="right num">
                      {pct(i.weight)}
                    </td>
                    <td data-label="Adds" className="right num">
                      {i.contribution === null ? "n/a" : dec(i.contribution, 1)}
                    </td>
                    <td data-label="To gain" className="right num">
                      {i.impact === null ? "n/a" : `+${dec(i.impact, 1)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {score.weightCoverage !== null ? (
            <p className="small muted">
              <Term id="weight-coverage">Inputs used</Term>: {pct(score.weightCoverage)} of this
              score's weight had data.
              {score.coverage !== null
                ? ` Code coverage behind the confidence: ${pct(score.coverage)}.`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
