"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHead, Pill, Stat } from "@/components/dashboard/kit";
import {
  EMPTY_LOG_FILTERS,
  LogsFilterBar,
  type LogFilterState,
} from "@/components/dashboard/logs-filter";
import { LogError, LogPager } from "@/components/dashboard/log-pager";
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

const SECTIONS: Array<{ value: Section; key: string }> = [
  { value: "task", key: "sectionAll" },
  { value: "drawing", key: "sectionDrawing" },
];

/**
 * Async task logs.
 *
 * new-api splits these into a general task log (video, music, …) and a
 * Midjourney-style drawing log; the two are tabs over one table here.
 */
export function TaskLogsView({ initial }: { initial: TaskPage }) {
  const locale = useLocale();
  const t = useTranslations("logsTask");
  const tc = useTranslations("logs");
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
          setError(payload?.message || t("errorLoad"));
          return;
        }
        const payload = (await response.json()) as TaskPage;
        setData(payload);
        setSection(payload.section);
        setPage(payload.page);
      } catch {
        setError(tc("errorServer"));
      } finally {
        setLoading(false);
      }
    },
    [data.pageSize, t, tc],
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
      <PageHead title={t("title")} sub={t("sub")} />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label={t("statTasks")} value={data.total.toLocaleString()} />
        <Stat label={tc("page")} value={`${data.page + 1} / ${pageCount}`} />
        <Stat label={t("statViewing")} value={t(section === "drawing" ? "sectionDrawing" : "sectionAll")} />
      </div>

      <div className="an-tabs" role="tablist" aria-label={t("tabsLabel")} style={{ marginTop: 18 }}>
        {SECTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={section === option.value}
            className={section === option.value ? "is-on" : undefined}
            onClick={() => chooseSection(option.value)}
          >
            {t(option.key)}
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

      {error ? <LogError message={error} /> : null}

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div className="twrap is-fixed">
          {section === "drawing" ? (
            <table className="dtable compact">
              <thead>
                <tr>
                  <th>{t("colSubmitTime")}</th>
                  <th>{tc("colAction")}</th>
                  <th>{t("colPrompt")}</th>
                  <th className="r">{t("colQuota")}</th>
                  <th>{t("colProgress")}</th>
                  <th>{tc("status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={6}>{t("emptyDrawing")}</td>
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
                          {row.status || t("unknown")}
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
                  <th>{t("colSubmitTime")}</th>
                  <th>{t("colPlatform")}</th>
                  <th>{tc("colAction")}</th>
                  <th>{t("colTaskId")}</th>
                  <th className="r">{t("colQuota")}</th>
                  <th>{t("colProgress")}</th>
                  <th>{tc("status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={7}>{t("emptyTask")}</td>
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
                            {row.status || t("unknown")}
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

        <LogPager
          first={first}
          last={last}
          total={data.total}
          page={page}
          pageCount={pageCount}
          loading={loading}
          onGoto={goto}
        />
      </div>
    </>
  );
}
