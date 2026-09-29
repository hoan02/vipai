"use client";

import { Fragment, useState } from "react";
import { PageHead, Pill, Stat } from "@/components/dashboard/kit";
import { LogsFilterBar } from "@/components/dashboard/logs-filter";
import { useLogPager } from "@/components/dashboard/use-log-page";
import type { AuditLogPage } from "@/server/logs";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The account's audit trail: authenticated actions taken with this account or its keys. */
export function AuditLogsView({ initial }: { initial: AuditLogPage }) {
  const { data, filters, setFilters, page, loading, error, apply, reset, goto } =
    useLogPager<AuditLogPage["items"][number]>("/api/usage-logs/audit", initial);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : data.page * data.pageSize + 1;
  const last = Math.min(data.total, (data.page + 1) * data.pageSize);

  return (
    <>
      <PageHead
        title="Audit logs"
        sub="Security-relevant actions on this account and its API keys, newest first."
      />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label="Events" value={data.total.toLocaleString()} />
        <Stat label="Page" value={`${data.page + 1} / ${pageCount}`} />
        <Stat label="Page size" value={String(data.pageSize)} />
      </div>

      <LogsFilterBar
        value={filters}
        onChange={setFilters}
        onApply={apply}
        onReset={reset}
        busy={loading}
        show={{ source: true, sourceLabel: "Token ref" }}
      />

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "var(--danger)" }} role="alert">
          {error}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div className="twrap">
          <table className="dtable compact">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Category</th>
                <th>Route</th>
                <th className="r">Status</th>
                <th>Result</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>No audit events match these filters.</td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{timeFmt.format(new Date(row.createdAt))}</td>
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
                          {row.success ? "Success" : "Failed"}
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
                                Request id{" "}
                                <code style={{ fontFamily: "var(--font-mono)" }}>{row.requestId}</code>
                              </span>
                            ) : null}
                            {row.tokenRef ? (
                              <span className="note">
                                Token{" "}
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
