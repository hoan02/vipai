"use client";

import { useEffect, useState } from "react";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";

type RedemptionRow = {
  id: number;
  name: string;
  key: string;
  status: number;
  usd: number;
  expiredTime: number;
};

export function RedemptionsView() {
  const [rows, setRows] = useState<RedemptionRow[]>([]);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("10");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const helper = useColumnHelper<RedemptionRow>();

  const load = async () => {
    setBusy(true);
    const response = await fetch("/api/admin/redemptions", { cache: "no-store" });
    const data = (response.ok ? await response.json() : { items: [] }) as { items?: RedemptionRow[] };
    setRows(data.items ?? []);
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setError(null);
    setNotice(null);
    setNewKeys([]);
    const result = await send<{ keys?: string[] }>("/api/admin/redemptions", "POST", {
      name,
      usd: Number(amount),
      count: Number(count),
    });
    if (result.message) {
      setError(result.message);
      return;
    }
    setNewKeys(result.data?.keys ?? []);
    setNotice("Codes created.");
    setName("");
    void load();
  };

  const remove = async (row: RedemptionRow) => {
    if (!window.confirm(`Delete code "${row.name}"? This cannot be undone.`)) return;
    setError(null);
    const result = await send(`/api/admin/redemptions/${row.id}`, "DELETE", {});
    if (result.message) {
      setError(result.message);
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const columns: Column<RedemptionRow>[] = [
    helper.accessor("name", { header: "Label" }),
    helper.accessor("key", {
      header: "Code",
      cell: (info) => (
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{info.getValue()}</code>
      ),
    }),
    helper.accessor("usd", {
      header: "USD",
      meta: { align: "right" },
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    }),
    helper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Pill tone={info.getValue() === 1 ? "ok" : "off"}>
          {info.getValue() === 1 ? "Unused" : info.getValue() === 3 ? "Used" : "Disabled"}
        </Pill>
      ),
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(row.original)}>
          Delete
        </button>
      ),
    }),
  ];

  return (
    <>
      <PageHead
        title="Redemptions"
        sub="Credit codes a customer redeems at Top up."
        side={
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => load()} disabled={busy}>
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="field"
            placeholder="Label"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 160 }}
            aria-label="Code label"
          />
          <input
            className="field"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 120 }}
            aria-label="Credit USD"
          />
          <input
            className="field"
            type="number"
            min="1"
            max="100"
            step="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{ width: 90 }}
            aria-label="Count"
          />
          <button className="btn btn-primary btn-sm" type="button" onClick={create}>
            Create codes
          </button>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          Each code is worth the given USD when redeemed. Creating codes needs payment compliance
          confirmed on the gateway.
        </p>

        {newKeys.length > 0 ? (
          <div className="panel" style={{ padding: 12, marginTop: 12 }}>
            <b>New codes — copy now</b>
            <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
              {newKeys.join("\n")}
            </pre>
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => String(r.id)}
            searchPlaceholder="Search label or code"
            empty="No codes"
          />
        </div>
      </div>
    </>
  );
}
