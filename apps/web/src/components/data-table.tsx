"use client";

import { type ReactNode, useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  /** Sort value. Columns without it are not sortable. */
  sort?: (row: T) => number | string | null;
  align?: "right";
  /** Hide on small screens inside the stacked card layout until "Details" is opened. */
  secondary?: boolean;
  className?: string;
}

/** Sortable table. On phones every row becomes a stacked card, secondary columns sit behind Details. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRow,
  caption,
  initialSort,
  pageSize = 25,
  empty = "No rows.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRow?: (row: T) => void;
  caption: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [shown, setShown] = useState(pageSize);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y))) * dir
      );
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) return <p className="muted">{empty}</p>;
  const visible = sorted.slice(0, shown);
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${c.align === "right" ? "right" : ""}${c.secondary ? " is-secondary" : ""}`}
                aria-sort={
                  sort?.key === c.key
                    ? sort.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                {c.sort ? (
                  <button
                    type="button"
                    className="th-btn"
                    onClick={() =>
                      setSort((s) => ({
                        key: c.key,
                        dir: s?.key === c.key && s.dir === "desc" ? "asc" : "desc",
                      }))
                    }
                  >
                    {c.label}
                    <span className="th-arrow" aria-hidden="true">
                      {sort?.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const k = rowKey(r);
            return (
              <tr key={k} className={onRow ? "is-click" : undefined}>
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    data-label={typeof c.label === "string" ? c.label : c.key}
                    className={`${c.align === "right" ? "right" : ""}${c.secondary ? " is-secondary" : ""} ${c.className ?? ""}`}
                  >
                    {i === 0 && onRow ? (
                      <button type="button" className="row-btn" onClick={() => onRow(r)}>
                        {c.render(r)}
                      </button>
                    ) : (
                      c.render(r)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown < sorted.length ? (
        <div className="table-more">
          <span className="muted small num">
            Showing {visible.length} of {sorted.length}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShown((s) => s + pageSize * 2)}
          >
            Show more
          </button>
        </div>
      ) : null}
    </div>
  );
}
