"use client";

import { useCallback, useState } from "react";
import { dayEnd, dayStart } from "@/lib/analytics";
import { EMPTY_LOG_FILTERS, type LogFilterState } from "./logs-filter";

/** A page as every logs endpoint returns it. */
export type LogPageShape<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

/** Builds the query string every logs route understands. */
export function toLogQuery(
  filters: LogFilterState,
  page: number,
  pageSize: number,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const from = filters.from ? dayStart(filters.from) : 0;
  const to = filters.to ? dayEnd(filters.to) : 0;
  if (from) params.set("from", String(from));
  if (to) params.set("to", String(to));
  if (filters.model.trim()) params.set("model", filters.model.trim());
  if (filters.group.trim()) params.set("group", filters.group.trim());
  if (filters.source.trim()) params.set("source", filters.source.trim());
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
}

/**
 * Paging and filtering for one logs section.
 *
 * The first page arrives with the server render; this only fetches when the
 * visitor changes the page or applies new filters, so the initial paint never
 * waits on a client round-trip.
 */
export function useLogPager<T>(endpoint: string, initial: LogPageShape<T>) {
  const [data, setData] = useState<LogPageShape<T> & Record<string, unknown>>(
    initial as LogPageShape<T> & Record<string, unknown>,
  );
  const [filters, setFilters] = useState<LogFilterState>(EMPTY_LOG_FILTERS);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, nextFilters: LogFilterState, extra: Record<string, string> = {}) => {
      setLoading(true);
      setError(null);
      try {
        const query = toLogQuery(nextFilters, nextPage, initial.pageSize, extra);
        const response = await fetch(`${endpoint}?${query}`, { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          setError(payload?.message || "Could not load the log.");
          return;
        }
        const payload = (await response.json()) as LogPageShape<T> & Record<string, unknown>;
        setData(payload);
        setPage(payload.page ?? nextPage);
      } catch {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    },
    [endpoint, initial.pageSize],
  );

  const apply = useCallback(
    (next: LogFilterState, extra: Record<string, string> = {}) => {
      setFilters(next);
      setPage(0);
      void load(0, next, extra);
    },
    [load],
  );

  const reset = useCallback(
    (extra: Record<string, string> = {}) => {
      setFilters(EMPTY_LOG_FILTERS);
      setPage(0);
      void load(0, EMPTY_LOG_FILTERS, extra);
    },
    [load],
  );

  const goto = useCallback(
    (nextPage: number, extra: Record<string, string> = {}) => {
      setPage(nextPage);
      void load(nextPage, filters, extra);
    },
    [filters, load],
  );

  return {
    data,
    filters,
    setFilters,
    page,
    loading,
    error,
    apply,
    reset,
    goto,
    reload: load,
  };
}
