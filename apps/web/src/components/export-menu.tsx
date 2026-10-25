"use client";

import { useEffect, useRef, useState } from "react";
import { download, printSvg, svgToPngBlob } from "@/lib/svg";

export interface ExportSource {
  /** File stem without extension, for example rip-repo-structure-2026-10-25. */
  stem: string;
  title: string;
  /** Builds the light themed, self-contained SVG document. */
  svg: () => string;
  /** Optional data for the JSON export. */
  data?: () => unknown;
  /** Extra text formats, for example Mermaid and DOT. */
  text?: { label: string; ext: string; type: string; build: () => string }[];
}

/** One consistent Export menu for every chart and diagram. Everything runs in the browser. */
export function ExportMenu({ source, label = "Export" }: { source: ExportSource; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const run = async (name: string, fn: () => void | Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const items: { id: string; label: string; hint: string; act: () => void | Promise<void> }[] = [
    {
      id: "svg",
      label: "SVG image",
      hint: "Vector, for documents",
      act: () => download(`${source.stem}.svg`, source.svg(), "image/svg+xml"),
    },
    {
      id: "png",
      label: "PNG image",
      hint: "2x resolution",
      act: async () =>
        download(`${source.stem}.png`, await svgToPngBlob(source.svg(), 2), "image/png"),
    },
    {
      id: "pdf",
      label: "PDF",
      hint: "Opens the print dialog",
      act: () => printSvg(source.svg(), source.title),
    },
  ];
  if (source.data)
    items.push({
      id: "json",
      label: "JSON data",
      hint: "The values behind the view",
      act: () =>
        download(
          `${source.stem}.json`,
          JSON.stringify(source.data?.(), null, 2),
          "application/json",
        ),
    });
  for (const t of source.text ?? [])
    items.push({
      id: t.ext,
      label: t.label,
      hint: `.${t.ext} text`,
      act: () => download(`${source.stem}.${t.ext}`, t.build(), t.type),
    });

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <svg className="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open ? (
        <div className="menu-list" role="menu" aria-label="Export formats">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={busy !== null}
              onClick={() => run(it.id, it.act)}
            >
              <span>{it.label}</span>
              <span className="menu-hint">{busy === it.id ? "Working" : it.hint}</span>
            </button>
          ))}
          {error ? (
            <p className="menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
