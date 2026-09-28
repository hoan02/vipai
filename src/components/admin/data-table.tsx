"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TFeatures, TData, TValue> {
    align?: "left" | "right";
  }
}

/**
 * The admin table, on TanStack Table v9.
 *
 * v9 registers only the features a table uses, and row models are feature
 * slots rather than options. Filtering, sorting and pagination are all
 * client-side over the rows handed in, which is what the admin needs: every
 * page already loads its rows from a route handler.
 *
 * The markup is the project's own `.dtable`, so the design system stays in
 * charge. Search is a global filter with a single string value; sorting comes
 * from each column definition's `sortFn`.
 */
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

export type Column<T extends RowData> = ColumnDef<typeof features, T, any>;

export function useColumnHelper<T extends RowData>() {
  return useMemo(() => createColumnHelper<typeof features, T>(), []);
}

export function DataTable<T extends RowData>({
  columns,
  rows,
  rowKey,
  searchable = true,
  pageSize = 25,
  empty = "No rows",
  toolbar,
  searchPlaceholder = "Search",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchable?: boolean;
  pageSize?: number;
  empty?: string;
  toolbar?: ReactNode;
  searchPlaceholder?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useTable({
    features,
    columns,
    data: rows,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getRowId: rowKey,
  });

  const pageCount = table.getPageCount();
  const { pageIndex } = table.state.pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <>
      {(searchable || toolbar) && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          {searchable ? (
            <input
              className="field"
              style={{ minWidth: 200, height: 34 }}
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              aria-label={searchPlaceholder}
            />
          ) : null}
          {toolbar}
        </div>
      )}

      <div className="twrap">
        <table className="dtable compact">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={header.column.columnDef.meta?.align === "right" ? "r" : undefined}
                      style={canSort ? { cursor: "pointer", userSelect: "none" } : undefined}
                      onClick={canSort ? (event) => header.column.getToggleSortingHandler?.()?.(event) : undefined}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      {canSort ? (
                        <span style={{ opacity: sorted ? 0.9 : 0.3, marginLeft: 4 }}>
                          {sorted === "desc" ? "▾" : "▴"}
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cell.column.columnDef.meta?.align === "right" ? "r" : undefined}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredCount > pageSize ? (
        <div className="dtable-foot">
          <span className="note">
            {pageIndex * pageSize + 1}–{Math.min(filteredCount, (pageIndex + 1) * pageSize)} / {filteredCount}
          </span>
          <span className="dtable-pager">
            <button
              className="pg"
              type="button"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              ‹
            </button>
            <span className="pg-n">
              {pageIndex + 1}/{Math.max(1, pageCount)}
            </span>
            <button
              className="pg"
              type="button"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              ›
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}
