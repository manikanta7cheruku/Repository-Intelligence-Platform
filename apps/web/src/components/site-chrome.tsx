"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { applySettings, readSettings, type ThemePref, writeSettings } from "@/lib/settings";

export const REPO_URL = "https://github.com/manikanta7cheruku/Repository-Intelligence-Platform";
const REPO_API = "https://api.github.com/repos/manikanta7cheruku/Repository-Intelligence-Platform";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="logo">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="currentColor" />
        <circle cx="12" cy="12" r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="var(--bg)" strokeWidth="1.5" />
      </svg>
      <span className="logo-word">RIP</span>
    </span>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePref>("system");
  useEffect(() => {
    setTheme(readSettings().theme);
    const sync = () => setTheme(readSettings().theme);
    window.addEventListener("rip-settings", sync);
    return () => window.removeEventListener("rip-settings", sync);
  }, []);
  const next: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
  const label = { system: "System theme", light: "Light theme", dark: "Dark theme" }[theme];
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`${label}. Switch theme`}
      title={label}
      onClick={() => {
        const s = readSettings();
        writeSettings({ ...s, theme: next[theme] });
      }}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      ) : theme === "light" ? (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect
            x="2"
            y="3"
            width="12"
            height="8"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M6 14h4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
    </button>
  );
}

/** Opens the repository page. Starring itself needs the visitor's own GitHub sign in, so this never pretends to star. */
export function StarButton() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem("rip-stars") ?? "null") as {
        n: number;
        t: number;
      } | null;
      if (cached && Date.now() - cached.t < 3_600_000) return setStars(cached.n);
    } catch {
      /* ignore */
    }
    const ctl = new AbortController();
    fetch(REPO_API, { signal: ctl.signal, headers: { accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { stargazers_count?: number } | null) => {
        if (j && typeof j.stargazers_count === "number") {
          setStars(j.stargazers_count);
          try {
            sessionStorage.setItem(
              "rip-stars",
              JSON.stringify({ n: j.stargazers_count, t: Date.now() }),
            );
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);
  return (
    <a className="btn btn-quiet" href={REPO_URL} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
      Star on GitHub
      {stars !== null && stars > 0 ? <span className="count num">{stars}</span> : null}
    </a>
  );
}

const NAV = [
  { href: "/#analyze", label: "Analyze" },
  { href: "/glossary", label: "Glossary" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/run-free", label: "Run it free" },
];

export function SiteChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    applySettings(readSettings());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applySettings(readSettings());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu whenever the route changes
  useEffect(() => setMenu(false), [path]);

  // Report pages draw their own chrome, including the main landmark.
  if (path.startsWith("/r/")) return <>{children}</>;

  return (
    <div className="site">
      <header className="site-head">
        <div className="site-head-in">
          <Link href="/" className="brand" aria-label="RIP home">
            <Logo />
          </Link>
          <nav className="site-nav" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="site-tools">
            <span className="hide-sm">
              <StarButton />
            </span>
            <ThemeToggle />
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label="Menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
        </div>
        {menu ? (
          <nav className="site-sheet" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
            <Link href="/settings">Settings</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        ) : null}
      </header>
      <main id="main" className="site-main">
        {children}
      </main>
      <footer className="site-foot">
        <div className="site-foot-in">
          <span>RIP, Repository Intelligence Platform. Apache-2.0.</span>
          <span className="foot-links">
            <Link href="/settings">Settings</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
