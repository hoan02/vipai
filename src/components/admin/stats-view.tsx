"use client";

import { DataTable, type Column } from "@/components/admin/data-table";
import { usd } from "@/lib/money";
import { PageHead, Stat } from "@/components/dashboard/kit";
import type { AdminStats, ModelStat } from "@/server/admin";

export function StatsView({ stats }: { stats: AdminStats }) {
  const columns: Column<ModelStat>[] = [
    { key: "id", header: "Model", sortValue: (r) => r.id, cell: (r) => r.id },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      sortValue: (r) => r.requests,
      cell: (r) => <span className="num">{r.requests.toLocaleString()}</span>,
    },
    {
      key: "tokensIn",
      header: "Tokens in",
      align: "right",
      sortValue: (r) => r.tokensIn,
      cell: (r) => <span className="num">{r.tokensIn.toLocaleString()}</span>,
    },
    {
      key: "tokensOut",
      header: "Tokens out",
      align: "right",
      sortValue: (r) => r.tokensOut,
      cell: (r) => <span className="num">{r.tokensOut.toLocaleString()}</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      sortValue: (r) => r.revenueUsd,
      cell: (r) => <span className="num">{usd(r.revenueUsd)}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      sortValue: (r) => r.costUsd ?? -1,
      cell: (r) => <span className="num">{r.costUsd === null ? "—" : usd(r.costUsd)}</span>,
    },
    {
      key: "margin",
      header: "Margin",
      align: "right",
      sortValue: (r) => r.marginUsd ?? -1,
      cell: (r) => (
        <span
          className="num"
          style={r.marginUsd !== null && r.marginUsd < 0 ? { color: "#b91c1c" } : undefined}
        >
          {r.marginUsd === null ? "—" : usd(r.marginUsd)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead title="Statistics" sub="Revenue, cost and margin over recent requests." />

      <div className="stats four" style={{ marginTop: 20 }}>
        <Stat label="Requests" value={stats.requests.toLocaleString()} />
        <Stat label="Revenue" value={usd(stats.revenueUsd)} />
        <Stat label="Cost" value={usd(stats.costUsd)} />
        <Stat
          label="Margin"
          value={usd(stats.marginUsd)}
          hint={stats.costComplete ? undefined : "cost incomplete for some models"}
        />
      </div>

      <div className="sh">
        <h2>By model</h2>
        <span className="hint">
          {stats.sampled.toLocaleString()} of {stats.total.toLocaleString()} requests
        </span>
      </div>
      <div className="panel" style={{ padding: 16 }}>
        <DataTable
          columns={columns}
          rows={stats.byModel}
          rowKey={(r) => r.id}
          searchText={(r) => r.id}
          searchPlaceholder="Search model"
          empty="No usage recorded yet"
        />
      </div>
    </>
  );
}
