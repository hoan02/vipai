"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHead, Pill, Stat } from "@/components/dashboard/kit";
import { LogsFilterBar } from "@/components/dashboard/logs-filter";
import { LogError, LogPager } from "@/components/dashboard/log-pager";
import { useLogPager } from "@/components/dashboard/use-log-page";
import { useLocale } from "@/components/site/I18n";
import { formatDateTime } from "@/lib/datetime";
import type { AuditLogPage } from "@/server/logs";

/** The account's audit trail: authenticated actions taken with this account or its keys. */
export function AuditLogsView({ initial }: { initial: AuditLogPage }) {
  const locale = useLocale();
  const t = useTranslations("logsAudit");
  const tc = useTranslations("logs");
  const { data, filters, setFilters, page, loading, error, apply, reset, goto } =
    useLogPager<AuditLogPage["items"][number]>("/api/usage-logs/audit", initial);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : data.page * data.pageSize + 1;
  const last = Math.min(data.total, (data.page + 1) * data.pageSize);

  return (
    <>
      <PageHead title={t("title")} sub={t("sub")} />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label={t("statEvents")} value={data.total.toLocaleString()} />
        <Stat label={tc("page")} value={`${data.page + 1} / ${pageCount}`} />
        <Stat label={t("statPageSize")} value={String(data.pageSize)} />
      </div>

      <LogsFilterBar
        value={filters}
        onChange={setFilters}
        onApply={apply}
        onReset={reset}
        busy={loading}
        show={{ source: true, sourceLabel: t("sourceLabel") }}
      />

      {error ? <LogError message={error} /> : null}

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div className="twrap is-fixed">
          <table className="dtable compact">
            <thead>
              <tr>
                <th>{tc("time")}</th>
                <th>{tc("colAction")}</th>
                <th>{t("colCategory")}</th>
                <th>{t("colRoute")}</th>
                <th className="r">{tc("status")}</th>
                <th>{t("colResult")}</th>
                <th>{t("colIp")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>{t("empty")}</td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{formatDateTime(row.createdAt, locale, { year: false, seconds: true })}</td>
                      <td>{row.action || "—"}</td>
                      <td>{row.category || "—"}</td>
                      <td>
                        <span className="cell-main">
                          <span>{row.route || "—"}</span>
                          {row.method ? <small>{row.method}</small> : null}
                        </span>
                      </td>
                      <td className="r num">{row.status}</td>
                      <td>
                        <Pill tone={row.success ? "ok" : "off"}>
                          {row.success ? t("success") : t("failed")}
                        </Pill>
                      </td>
                      <td>{row.ip || "—"}</td>
                    </tr>
                    {expanded === row.id ? (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--d-soft)", paddingTop: 0, paddingBottom: 10 }}>
                          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                            {row.requestId ? (
                              <span className="note">
                                {tc("requestId")}{" "}
                                <code style={{ fontFamily: "var(--font-mono)" }}>{row.requestId}</code>
                              </span>
                            ) : null}
                            {row.tokenRef ? (
                              <span className="note">
                                {t("token")}{" "}
                                <code style={{ fontFamily: "var(--font-mono)" }}>{row.tokenRef}</code>
                              </span>
                            ) : null}
                            {row.content ? <span className="note">{row.content}</span> : null}
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
