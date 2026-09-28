"use client";

import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { usd } from "@/lib/money";
import { PageHead, Stat } from "@/components/dashboard/kit";
import type { AdminStats, ModelStat } from "@/server/admin";

export function StatsView({ stats }: { stats: AdminStats }) {
  const helper = useColumnHelper<ModelStat>();

  const columns: Column<ModelStat>[] = [
    helper.accessor("id", { header: "Model" }),
    helper.accessor("requests", {
      header: "Requests",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue().toLocaleString()}</span>,
    }),
    helper.accessor("tokensIn", {
      header: "Tokens in",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue().toLocaleString()}</span>,
    }),
    helper.accessor("tokensOut", {
      header: "Tokens out",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue().toLocaleString()}</span>,
    }),
    helper.accessor("revenueUsd", {
      header: "Revenue",
      meta: { align: "right" },
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    }),
    helper.accessor((row) => row.costUsd ?? -1, {
      id: "cost",
      header: "Cost",
      meta: { align: "right" },
      cell: (info) => (
        <span className="num">{info.getValue() < 0 ? "—" : usd(info.getValue())}</span>
      ),
    }),
    helper.accessor((row) => row.marginUsd ?? -1, {
      id: "margin",
      header: "Margin",
      meta: { align: "right" },
      cell: (info) => {
        const value = info.getValue();
        return (
          <span className="num" style={value < 0 ? { color: "#b91c1c" } : undefined}>
            {value === -1 ? "—" : usd(value)}
          </span>
        );
      },
    }),
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
          searchPlaceholder="Search model"
          empty="No usage recorded yet"
        />
      </div>
    </>
  );
}
