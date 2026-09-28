"use client";

import { useMemo, useState, type ReactNode } from "react";

/**
 * A small reusable table: search, click-to-sort and pagination over the
 * dashboard's own `.dtable` styling. Headless on purpose — the project ships
 * its own design system, so a UI kit would fight it. Columns supply their own
 * cell renderer, which lets editable rows (inputs) sit in the same table as
 * read-only ones.
 */
export type Column<T> = {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  /** Provide to make the header sortable. */
  sortValue?: (row: T) => string | number;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchText,
  pageSize = 20,
  empty = "No rows",
  toolbar,
  searchPlaceholder = "Search",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  pageSize?: number;
  empty?: string;
  toolbar?: ReactNode;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q && searchText ? rows.filter((row) => searchText(row).toLowerCase().includes(q)) : rows;
    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column?.sortValue) {
        const value = column.sortValue;
        out = [...out].sort((a, b) => {
          const av = value(a);
          const bv = value(b);
          return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const view = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 },
    );
  };

  return (
    <>
      {(searchText || toolbar) && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          {searchText ? (
            <input
              className="field"
              style={{ minWidth: 220 }}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              aria-label={searchPlaceholder}
            />
          ) : null}
          {toolbar}
        </div>
      )}

      <div className="twrap">
        <table className="dtable">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    className={column.align === "right" ? "r" : undefined}
                    style={column.sortValue ? { cursor: "pointer", userSelect: "none" } : undefined}
                    onClick={column.sortValue ? () => toggleSort(column.key) : undefined}
                    aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
                  >
                    {column.header}
                    {column.sortValue ? (
                      <span style={{ opacity: active ? 0.9 : 0.35, marginLeft: 4 }}>
                        {active && sort!.dir === -1 ? "▾" : "▴"}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              view.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.align === "right" ? "r" : undefined}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize ? (
        <div
          className="toolbar"
          style={{ justifyContent: "space-between", alignItems: "center", marginTop: 12 }}
        >
          <span className="note">
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of{" "}
            {filtered.length}
          </span>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}
