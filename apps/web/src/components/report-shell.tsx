"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { dateText, pct, shortSha } from "@/lib/format";
import { MOBILE_TABS, SECTIONS } from "@/lib/sections";
import { CommandPalette } from "./command-palette";
import { Drawer } from "./drawer";
import { Icon } from "./icons";
import { ReportLoader, useReport } from "./report-context";
import { Logo, ThemeToggle } from "./site-chrome";

export function ReportShell({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ReportLoader id={id}>
      <Frame>{children}</Frame>
    </ReportLoader>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { id, report } = useReport();
  const path = usePathname();
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const active = path.split("/")[3] ?? "briefing";

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the sheet on navigation
  useEffect(() => setMore(false), [path]);

  const analyzed = report.repository.codeFiles
    ? report.repository.analyzedCodeFiles / report.repository.codeFiles
    : null;
  const notAssessed = report.scores.filter((s) => s.state === "not-assessed").length;

  return (
    <div className="app">
      <aside className="rail" aria-label="Report sections">
        <Link href="/" className="rail-brand" aria-label="RIP home">
          <Logo />
        </Link>
        <div className="rail-repo">
          <div className="rail-repo-name" title={report.repository.name}>
            {report.repository.name}
          </div>
          <div className="rail-repo-meta mono">
            {shortSha(report.repository.commitSha)} {id === "sample" ? " sample" : ""}
          </div>
        </div>
        <nav className="rail-nav">
          {SECTIONS.map((s) => (
            <Link
              key={s.slug}
              href={`/r/${id}/${s.slug}`}
              className="rail-link"
              aria-current={active === s.slug ? "page" : undefined}
            >
              <Icon name={s.icon} />
              <span>{s.label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-foot">
          <Link href="/glossary" className="rail-link">
            <Icon name="glossary" />
            <span>Glossary</span>
          </Link>
          <Link href="/settings" className="rail-link">
            <Icon name="more" />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      <div className="stage">
        <header className="topbar">
          <Link href="/" className="topbar-home" aria-label="RIP home">
            <Logo size={20} />
          </Link>
          <div className="topbar-title">
            <span className="topbar-repo">{report.repository.name}</span>
            <span className="topbar-sub">
              {report.repository.source.type === "github" ? "GitHub" : "Local"} | analyzed{" "}
              {dateText(report.reproducibility.finishedAt)}
            </span>
          </div>
          <button
            type="button"
            className="search-btn"
            onClick={() => setPalette(true)}
            aria-label="Search the report"
          >
            <Icon name="search" />
            <span className="search-text">Search files, findings, terms</span>
            <kbd className="hide-sm">Ctrl K</kbd>
          </button>
          <ThemeToggle />
        </header>

        <main id="main" className="content" tabIndex={-1}>
          <div className="content-in">{children}</div>
        </main>

        <section className="strip" aria-label="Reliability of this analysis">
          <Link href={`/r/${id}/briefing#reliability`} className="strip-link">
            <span className={`dot dot-${report.status}`} aria-hidden="true" />
            <span className="strip-k">
              {report.status === "complete" ? "Complete analysis" : "Partial analysis"}
            </span>
          </Link>
          <span className="strip-i">
            <span className="strip-k">Code analyzed</span> <b className="num">{pct(analyzed)}</b>
          </span>
          <span className="strip-i hide-sm">
            <span className="strip-k">Not assessed</span> <b className="num">{notAssessed}</b>
          </span>
          <span className="strip-i hide-sm">
            <span className="strip-k">Schema</span> <b className="num">{report.schemaVersion}</b>
          </span>
        </section>
      </div>

      <nav className="tabs" aria-label="Report sections">
        {SECTIONS.filter((s) => MOBILE_TABS.includes(s.slug)).map((s) => (
          <Link
            key={s.slug}
            href={`/r/${id}/${s.slug}`}
            className="tab"
            aria-current={active === s.slug ? "page" : undefined}
          >
            <Icon name={s.icon} size={20} />
            <span>{s.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className="tab"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
        >
          <Icon name="more" size={20} />
          <span>More</span>
        </button>
      </nav>

      {more ? (
        <>
          <button
            type="button"
            className="scrim"
            aria-label="Close menu"
            onClick={() => setMore(false)}
          />
          <div className="sheet" role="dialog" aria-label="All sections">
            <div className="drawer-grip" aria-hidden="true" />
            <ul className="sheet-list">
              {SECTIONS.filter((s) => !MOBILE_TABS.includes(s.slug)).map((s) => (
                <li key={s.slug}>
                  <Link href={`/r/${id}/${s.slug}`} className="sheet-item">
                    <Icon name={s.icon} size={20} />
                    <span>
                      <b>{s.label}</b>
                      <small>{s.summary}</small>
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/glossary" className="sheet-item">
                  <Icon name="glossary" size={20} />
                  <span>
                    <b>Glossary</b>
                    <small>Every term explained</small>
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </>
      ) : null}

      <Drawer />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
