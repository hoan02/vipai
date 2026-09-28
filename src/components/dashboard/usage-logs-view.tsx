"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHead, Pill, Stat } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";

type LogRow = {
  id: string;
  createdAt: string;
  model: string;
  source: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  stream: boolean;
  seconds: number;
  group: string;
  ip: string;
  requestId: string;
};

type LogPage = {
  page: number;
  pageSize: number;
  total: number;
  stat: { quotaUsd: number; rpm: number; tpm: number };
  items: LogRow[];
};

const PAGE_SIZE = 20;

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
export function UsageLogsView({ initial }: { initial: LogPage }) {
  const [data, setData] = useState<LogPage>(initial);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (next: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/usage-logs?page=${next}&pageSize=${PAGE_SIZE}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message || "Could not load the log.");
        return;
      }
      const payload = (await response.json()) as LogPage;
      setData(payload);
      setPage(payload.page);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The first page arrives with the render; only later pages are fetched.
    if (page !== initial.page) void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
        <Stat label="Spent (recent)" value={usd(data.stat.quotaUsd)} hint="over the last window" />
        <Stat label="Rate" value={`${data.stat.rpm} rpm · ${data.stat.tpm} tpm`} />
      </div>

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "#b91c1c" }} role="alert">
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
                <th className="r">Tokens in</th>
                <th className="r">Tokens out</th>
                <th className="r">Cost</th>
                <th className="r">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>No requests recorded yet.</td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <>
                    <tr
                      key={row.id}
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
                      <td className="r num">{row.promptTokens.toLocaleString()}</td>
                      <td className="r num">{row.completionTokens.toLocaleString()}</td>
                      <td className="r num">{usd(row.costUsd)}</td>
                      <td className="r num">{row.seconds ? `${row.seconds.toFixed(1)}s` : "—"}</td>
                    </tr>
                    {expanded === row.id ? (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={7} style={{ background: "var(--d-soft)" }}>
                          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "4px 0" }}>
                            {row.requestId ? (
                              <span className="note">
                                Request id{" "}
                                <code style={{ fontFamily: "var(--font-mono)" }}>{row.requestId}</code>
                              </span>
                            ) : null}
                            <span className="note">Group {row.group}</span>
                            {row.ip ? <span className="note">From {row.ip}</span> : null}
                            <span className="note">
                              Tokens {row.promptTokens.toLocaleString()} in,{" "}
                              {row.completionTokens.toLocaleString()} out
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
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
              onClick={() => setPage((p) => Math.max(0, p - 1))}
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
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
