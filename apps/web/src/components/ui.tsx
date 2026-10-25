"use client";

import type { Confidence, Severity } from "@repolens/core/browser";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { severityLabel } from "@/lib/format";
import { entry } from "@/lib/glossary";

/** Severity is always a word plus a shape, never color alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`sev sev-${severity}`}>
      <span className="sev-mark" aria-hidden="true" />
      {severityLabel[severity]}
    </span>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: "muted" | "solid" }) {
  return <span className={`chip${tone ? ` chip-${tone}` : ""}`}>{children}</span>;
}

export function ConfidenceChip({ value }: { value: Confidence | null }) {
  if (value === null) return <Chip tone="muted">Not assessed</Chip>;
  return <Chip>{value.charAt(0).toUpperCase() + value.slice(1)} confidence</Chip>;
}

export function Bar({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar" role="img" aria-label={label}>
      <div className="bar-fill" style={{ width: `${w}%` }} />
    </div>
  );
}

/** A glossary term with a click, focus and hover explanation. Used sparingly, on terms people need. */
export function Term({
  id,
  children,
  onMore,
}: {
  id: string;
  children?: ReactNode;
  onMore?: (id: string) => void;
}) {
  const e = entry(id);
  const [open, setOpen] = useState(false);
  const uid = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent | KeyboardEvent) => {
      if (ev instanceof KeyboardEvent) {
        if (ev.key === "Escape") setOpen(false);
      } else if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!e) return <>{children ?? id}</>;
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 220);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only enhances the focusable button inside
    <span className="term-wrap" ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        onFocus={() => setOpen(true)}
        className="term"
        aria-expanded={open}
        aria-describedby={open ? uid : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {children ?? e.label}
      </button>
      {open ? (
        <span className="pop" role="tooltip" id={uid}>
          <strong className="pop-title">{e.label}</strong>
          <span className="pop-body">{e.plain}</span>
          <a
            className="pop-more"
            href={`/glossary#${e.id}`}
            onClick={(ev) => {
              if (onMore) {
                ev.preventDefault();
                onMore(e.id);
              }
            }}
          >
            More about this term
          </a>
        </span>
      ) : null}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <div className="empty-body">{children}</div> : null}
    </div>
  );
}

/** Missing data is never shown as zero. This explains why and, when known, what would enable it. */
export function NotAssessed({ reason, hint }: { reason: string | null; hint?: string }) {
  return (
    <div className="na">
      <span className="na-tag">Not assessed</span>
      <span className="na-text">{reason ?? "No reason was recorded."}</span>
      {hint ? <span className="na-hint">{hint}</span> : null}
    </div>
  );
}

export function PageHead({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1 className="h1">{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  aside,
  children,
  id,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="card" id={id}>
      {title || aside ? (
        <div className="card-head">
          {title ? <h2 className="h3">{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg-btn${value === o.value ? " is-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
