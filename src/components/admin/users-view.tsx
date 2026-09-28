"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
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
    {
      key: "user",
      header: "User",
      sortValue: (r) => r.username,
      cell: (r) => (
        <span className="cell-main">
          <span>{r.username}</span>
          <small>{r.email || "—"}</small>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (r) => r.role,
      cell: (r) => (r.role >= 100 ? "Root" : r.role >= 10 ? "Admin" : "User"),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      cell: (r) => (
        <Pill tone={r.status === 1 ? "ok" : "off"}>{r.status === 1 ? "Enabled" : "Disabled"}</Pill>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      sortValue: (r) => r.balanceUsd,
      cell: (r) => <span className="num">{usd(r.balanceUsd)}</span>,
    },
    {
      key: "used",
      header: "Used",
      align: "right",
      sortValue: (r) => r.usedUsd,
      cell: (r) => <span className="num">{usd(r.usedUsd)}</span>,
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      sortValue: (r) => r.requestCount,
      cell: (r) => <span className="num">{r.requestCount.toLocaleString()}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => action(r, "add_quota")}>
            +$
          </button>
          {r.status === 1 ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => action(r, "disable")}>
              Disable
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => action(r, "enable")}>
              Enable
            </button>
          )}
        </span>
      ),
    },
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
          searchText={(r) => `${r.username} ${r.email ?? ""}`}
          searchPlaceholder="Filter loaded accounts"
          empty="No accounts"
        />
      </div>
    </>
  );
}
