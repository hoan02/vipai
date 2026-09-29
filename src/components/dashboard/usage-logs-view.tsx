"use client";

import { Fragment, useState } from "react";
import { PageHead, Stat } from "@/components/dashboard/kit";
import { LogsFilterBar } from "@/components/dashboard/logs-filter";
import { useLogPager } from "@/components/dashboard/use-log-page";
import { usd } from "@/lib/money";
import type { UsageLogPage } from "@/server/logs";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * The account's request log.
 *
 * Loaded through this app's own route rather than the gateway directly, so the
 * bearer token stays server-side. Paging is server-side too: the gateway caps a
 * page at 100 rows and an active account can have far more than one page.
 */
export function UsageLogsView({ initial }: { initial: UsageLogPage }) {
  const { data, filters, setFilters, page, loading, error, apply, reset, goto } =
    useLogPager<UsageLogPage["items"][number]>("/api/usage-logs", initial);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : data.page * data.pageSize + 1;
  const last = Math.min(data.total, (data.page + 1) * data.pageSize);

  return (
    <>
      <PageHead
        title="Usage logs"
        sub="Every request this account has made, with the model, tokens and charge."
      />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label="Requests" value={data.total.toLocaleString()} />
        <Stat
          label="Spent (recent)"
          value={usd(initial.stat.quotaUsd)}
          hint="over the last window"
        />
        <Stat label="Rate" value={`${initial.stat.rpm} rpm · ${initial.stat.tpm} tpm`} />
      </div>

      <LogsFilterBar
        value={filters}
        onChange={setFilters}
        onApply={apply}
        onReset={reset}
        busy={loading}
        show={{ model: true, group: true, source: true }}
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
                <th>Model</th>
                <th>Key</th>
                <th>Group</th>
                <th className="r">Tokens in</th>
                <th className="r">Tokens out</th>
                <th className="r">Cost</th>
                <th className="r">Latency</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={8}>No requests match these filters.</td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{dayFmt.format(new Date(row.createdAt))}</td>
                      <td>
                        <span className="cell-main">
                          <span>{row.model}</span>
                          {row.stream ? <small>streamed</small> : null}
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
                                Request id{" "}
                                <code style={{ fontFamily: "var(--font-mono)" }}>{row.requestId}</code>
                              </span>
                            ) : null}
                            <span className="note">
                              Tokens {row.promptTokens.toLocaleString()} in,{" "}
                              {row.completionTokens.toLocaleString()} out
                            </span>
                            {row.ip ? <span className="note">From {row.ip}</span> : null}
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
