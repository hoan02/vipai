"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHead, Stat } from "@/components/dashboard/kit";
import { LogsFilterBar } from "@/components/dashboard/logs-filter";
import { LogError, LogPager } from "@/components/dashboard/log-pager";
import { useLogPager } from "@/components/dashboard/use-log-page";
import { useLocale } from "@/components/site/I18n";
import { formatDateTime } from "@/lib/datetime";
import { usd } from "@/lib/money";
import type { UsageLogPage } from "@/server/logs";

/**
 * The account's request log.
 *
 * Loaded through this app's own route rather than the gateway directly, so the
 * bearer token stays server-side. Paging is server-side too: the gateway caps a
 * page at 100 rows and an active account can have far more than one page.
 */
export function UsageLogsView({ initial }: { initial: UsageLogPage }) {
  const locale = useLocale();
  const t = useTranslations("logsUsage");
  const tc = useTranslations("logs");
  const { data, filters, setFilters, page, loading, error, apply, reset, goto } =
    useLogPager<UsageLogPage["items"][number]>("/api/usage-logs", initial);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : data.page * data.pageSize + 1;
  const last = Math.min(data.total, (data.page + 1) * data.pageSize);

  return (
    <>
      <PageHead title={t("title")} sub={t("sub")} />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label={t("statRequests")} value={data.total.toLocaleString()} />
        <Stat label={t("statSpent")} value={usd(initial.stat.quotaUsd)} hint={t("statSpentHint")} />
        <Stat label={t("statRate")} value={`${initial.stat.rpm} rpm · ${initial.stat.tpm} tpm`} />
      </div>

      <LogsFilterBar
        value={filters}
        onChange={setFilters}
        onApply={apply}
        onReset={reset}
        busy={loading}
        show={{ model: true, group: true, source: true }}
      />

      {error ? <LogError message={error} /> : null}

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div className="twrap is-fixed">
          <table className="dtable compact">
            <thead>
              <tr>
                <th>{tc("time")}</th>
                <th>{tc("model")}</th>
                <th>{t("colKey")}</th>
                <th>{tc("group")}</th>
                <th className="r">{t("colTokensIn")}</th>
                <th className="r">{t("colTokensOut")}</th>
                <th className="r">{t("colCost")}</th>
                <th className="r">{t("colLatency")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={8}>{t("empty")}</td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{formatDateTime(row.createdAt, locale, { year: false, seconds: true })}</td>
                      <td>
                        <span className="cell-main">
                          <span>{row.model}</span>
                          {row.stream ? <small>{t("streamed")}</small> : null}
                        </span>
                      </td>
                      <td>{row.source}</td>
                      <td>{row.group}</td>
                      <td className="r num">{row.promptTokens.toLocaleString()}</td>
                      <td className="r num">{row.completionTokens.toLocaleString()}</td>
                      <td className="r num">{usd(row.costUsd)}</td>
                      <td className="r num">{row.seconds ? `${row.seconds.toFixed(1)}s` : "—"}</td>
                    </tr>
                    {expanded === row.id ? (
                      <tr>
                        <td colSpan={8} style={{ background: "var(--d-soft)", paddingTop: 0, paddingBottom: 10 }}>
                          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                            {row.requestId ? (
                              <span className="note">
                                {tc("requestId")}{" "}
                                <code style={{ fontFamily: "var(--font-mono)" }}>{row.requestId}</code>
                              </span>
                            ) : null}
                            <span className="note">
                              {t("tokensLine", {
                                in: row.promptTokens.toLocaleString(),
                                out: row.completionTokens.toLocaleString(),
                              })}
                            </span>
                            {row.ip ? <span className="note">{t("fromIp", { ip: row.ip })}</span> : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
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
