"use client";

import { useEffect, useState } from "react";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";

type UserRow = {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: number;
  status: number;
  balanceUsd: number;
  usedUsd: number;
  requestCount: number;
  group: string;
};

export function UsersView() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const helper = useColumnHelper<UserRow>();

  const load = async (keyword = "") => {
    setBusy(true);
    const response = await fetch(
      `/api/admin/users${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`,
      { cache: "no-store" },
    );
    const data = (response.ok ? await response.json() : { items: [] }) as { items?: UserRow[] };
    setRows(data.items ?? []);
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const action = async (
    row: UserRow,
    kind: "enable" | "disable" | "add_quota",
  ) => {
    setError(null);
    setNotice(null);
    let usdAmount: number | undefined;
    if (kind === "add_quota") {
      const input = window.prompt("Add credit (USD). Use a negative value to deduct.", "10");
      if (input === null) return;
      usdAmount = Number(input);
      if (!Number.isFinite(usdAmount) || usdAmount === 0) {
        setError("Enter a non-zero USD amount.");
        return;
      }
    }
    const result = await send(`/api/admin/users/${row.id}`, "POST", {
      action: kind,
      usd: usdAmount,
    });
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(`Done: ${kind}.`);
    void load(query);
  };

  const columns: Column<UserRow>[] = [
    helper.accessor("username", {
      header: "User",
      cell: (info) => (
        <span className="cell-main">
          <span>{info.getValue()}</span>
          <small>{info.row.original.email || "—"}</small>
        </span>
      ),
    }),
    helper.accessor("role", {
      header: "Role",
      cell: (info) => (info.getValue() >= 100 ? "Root" : info.getValue() >= 10 ? "Admin" : "User"),
    }),
    helper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Pill tone={info.getValue() === 1 ? "ok" : "off"}>
          {info.getValue() === 1 ? "Enabled" : "Disabled"}
        </Pill>
      ),
    }),
    helper.accessor("balanceUsd", {
      header: "Balance",
      meta: { align: "right" },
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    }),
    helper.accessor("usedUsd", {
      header: "Used",
      meta: { align: "right" },
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    }),
    helper.accessor("requestCount", {
      header: "Requests",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue().toLocaleString()}</span>,
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => action(row.original, "add_quota")}
          >
            +$
          </button>
          {row.original.status === 1 ? (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => action(row.original, "disable")}
            >
              Disable
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => action(row.original, "enable")}
            >
              Enable
            </button>
          )}
        </span>
      ),
    }),
  ];

  return (
    <>
      <PageHead
        title="Accounts"
        sub="Every account, with credit and usage. Enable, disable or adjust credit."
        side={
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => load(query)} disabled={busy}>
            {busy ? "Loading…" : "Reload"}
          </button>
        }
      />

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "#b91c1c" }} role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="panel" style={{ padding: 14, marginTop: 16 }} role="status">
          {notice}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input
            className="field"
            placeholder="Search username / email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 240 }}
            aria-label="Search users"
          />
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => load(query)} disabled={busy}>
            Search
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.id)}
          searchPlaceholder="Filter loaded accounts"
          empty="No accounts"
        />
      </div>
    </>
  );
}
