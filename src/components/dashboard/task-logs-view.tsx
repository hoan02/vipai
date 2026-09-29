"use client";

import { useCallback, useState } from "react";
import { PageHead, Pill, Stat } from "@/components/dashboard/kit";
import {
  EMPTY_LOG_FILTERS,
  LogsFilterBar,
  type LogFilterState,
} from "@/components/dashboard/logs-filter";
import { toLogQuery } from "@/components/dashboard/use-log-page";
import { useLocale } from "@/components/site/I18n";
import { formatDateTime } from "@/lib/datetime";
import { usd } from "@/lib/money";
import type { DrawingLogRow, TaskLogRow } from "@/server/logs";

type Section = "task" | "drawing";

type TaskPage = {
  section: Section;
  page: number;
  pageSize: number;
  total: number;
  items: Array<TaskLogRow | DrawingLogRow>;
};

const SECTIONS: Array<{ value: Section; label: string }> = [
  { value: "task", label: "All tasks" },
  { value: "drawing", label: "Drawing" },
];

/**
 * Async task logs.
 *
 * new-api splits these into a general task log (video, music, …) and a
 * Midjourney-style drawing log; the two are tabs over one table here.
 */
export function TaskLogsView({ initial }: { initial: TaskPage }) {
  const locale = useLocale();
  const [data, setData] = useState<TaskPage>(initial);
  const [section, setSection] = useState<Section>(initial.section);
  const [filters, setFilters] = useState<LogFilterState>(EMPTY_LOG_FILTERS);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextSection: Section, nextPage: number, nextFilters: LogFilterState) => {
      setLoading(true);
      setError(null);
      try {
        const query = toLogQuery(nextFilters, nextPage, data.pageSize, { section: nextSection });
        const response = await fetch(`/api/usage-logs/task?${query}`, { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          setError(payload?.message || "Could not load the task log.");
          return;
        }
        const payload = (await response.json()) as TaskPage;
        setData(payload);
        setSection(payload.section);
        setPage(payload.page);
      } catch {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    },
    [data.pageSize],
  );

  const chooseSection = (next: Section) => {
    setSection(next);
    void load(next, 0, filters);
  };

  const apply = (next: LogFilterState) => {
    setFilters(next);
    setPage(0);
    void load(section, 0, next);
  };

  const reset = () => {
    setFilters(EMPTY_LOG_FILTERS);
    setPage(0);
    void load(section, 0, EMPTY_LOG_FILTERS);
  };

  const goto = (nextPage: number) => {
    setPage(nextPage);
    void load(section, nextPage, filters);
  };

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : data.page * data.pageSize + 1;
  const last = Math.min(data.total, (data.page + 1) * data.pageSize);

  return (
    <>
      <PageHead
        title="Task logs"
        sub="Asynchronous jobs this account submitted — video, music, drawing and more."
      />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label="Tasks" value={data.total.toLocaleString()} />
        <Stat label="Page" value={`${data.page + 1} / ${pageCount}`} />
        <Stat label="Viewing" value={section === "drawing" ? "Drawing" : "All tasks"} />
      </div>

      <div className="an-tabs" role="tablist" aria-label="Task log kind" style={{ marginTop: 18 }}>
        {SECTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={section === option.value}
            className={section === option.value ? "is-on" : undefined}
            onClick={() => chooseSection(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <LogsFilterBar
        value={filters}
        onChange={setFilters}
        onApply={apply}
        onReset={reset}
        busy={loading}
        show={{ model: false, group: true }}
      />

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "var(--danger)" }} role="alert">
          {error}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div className="twrap is-fixed">
          {section === "drawing" ? (
            <table className="dtable compact">
              <thead>
                <tr>
                  <th>Submit time</th>
                  <th>Action</th>
                  <th>Prompt</th>
                  <th className="r">Quota</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={6}>No drawing tasks match these filters.</td>
                  </tr>
                ) : (
                  (data.items as DrawingLogRow[]).map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt, locale, { year: false })}</td>
                      <td>{row.action || "—"}</td>
                      <td style={{ maxWidth: 420, whiteSpace: "normal" }}>
                        {row.imageUrl ? (
                          <a className="link" href={row.imageUrl} target="_blank" rel="noreferrer">
                            {row.prompt || row.imageUrl}
                          </a>
                        ) : (
                          row.prompt || "—"
                        )}
                      </td>
                      <td className="r num">{usd(row.quotaUsd)}</td>
                      <td>{row.progress || "—"}</td>
                      <td>
                        <Pill tone={row.status === "SUCCESS" ? "ok" : "off"}>
                          {row.status || "unknown"}
                        </Pill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="dtable compact">
              <thead>
                <tr>
                  <th>Submit time</th>
                  <th>Platform</th>
                  <th>Action</th>
                  <th>Task id</th>
                  <th className="r">Quota</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={7}>No tasks match these filters.</td>
                  </tr>
                ) : (
                  (data.items as TaskLogRow[]).map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt, locale, { year: false })}</td>
                      <td>{row.platform || "—"}</td>
                      <td>{row.action || "—"}</td>
                      <td>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                          {row.taskId || "—"}
                        </code>
                      </td>
                      <td className="r num">{usd(row.quotaUsd)}</td>
                      <td>{row.progress || "—"}</td>
                      <td>
                        <span className="cell-main">
                          <Pill tone={row.status === "SUCCESS" ? "ok" : "off"}>
                            {row.status || "unknown"}
                          </Pill>
                          {row.failReason ? <small>{row.failReason}</small> : null}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="dtable-foot">
          <span className="note">
            {first}–{last} / {data.total.toLocaleString()}
            {loading ? " · loading…" : ""}
          </span>
          <span className="dtable-pager">
            <button
              className="pg"
              type="button"
              aria-label="Previous page"
              disabled={page === 0 || loading}
              onClick={() => goto(Math.max(0, page - 1))}
            >
              ‹
            </button>
            <span className="pg-n">
              {page + 1}/{pageCount}
            </span>
            <button
              className="pg"
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount - 1 || loading}
              onClick={() => goto(page + 1)}
            >
              ›
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
