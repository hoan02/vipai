"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";
import type { MarginConfig, ModelPrice } from "@/server/admin";

type CostRow = { id: string; costIn: string; costOut: string; margin: string };

function toCostRows(costs: MarginConfig[]): CostRow[] {
  return costs.map((cost) => ({
    id: cost.id,
    costIn: cost.in > 0 ? String(cost.in) : "",
    costOut: cost.out > 0 ? String(cost.out) : "",
    margin: cost.margin > 0 ? String(Math.round(cost.margin * 10000) / 100) : "",
  }));
}

function costCell(
  value: string,
  onChange: (value: string) => void,
  label: string,
  width = 110,
): React.ReactNode {
  return (
    <input
      className="field"
      type="number"
      step="0.0001"
      min="0"
      style={{ width, textAlign: "right" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
  );
}

export function MarginView({
  initialPrices,
  initialCosts,
}: {
  initialPrices: ModelPrice[];
  initialCosts: MarginConfig[];
}) {
  const router = useRouter();
  const [costRows, setCostRows] = useState<CostRow[]>(() => toCostRows(initialCosts));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setCell = (id: string, field: "costIn" | "costOut" | "margin", value: string) =>
    setCostRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const save = async (apply: boolean) => {
    const models = costRows.map((row) => ({
      id: row.id,
      in: Number(row.costIn) || 0,
      out: Number(row.costOut) || 0,
      margin: (Number(row.margin) || 0) / 100,
    }));
    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await send("/api/admin/margin", "PUT", { models, apply });
    setSaving(false);
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(apply ? "Saved costs and repriced retail." : "Saved costs and margins.");
    if (apply) router.refresh();
  };

  const priceById = new Map(initialPrices.map((price) => [price.id, price]));

  const columns: Column<CostRow>[] = [
    { key: "id", header: "Model", sortValue: (r) => r.id, cell: (r) => r.id },
    {
      key: "costIn",
      header: "Cost in",
      align: "right",
      cell: (r) => costCell(r.costIn, (v) => setCell(r.id, "costIn", v), `Cost in for ${r.id}`),
    },
    {
      key: "costOut",
      header: "Cost out",
      align: "right",
      cell: (r) => costCell(r.costOut, (v) => setCell(r.id, "costOut", v), `Cost out for ${r.id}`),
    },
    {
      key: "margin",
      header: "Margin %",
      align: "right",
      cell: (r) => costCell(r.margin, (v) => setCell(r.id, "margin", v), `Margin for ${r.id}`, 90),
    },
    {
      key: "retailIn",
      header: "Retail in",
      align: "right",
      sortValue: (r) => priceById.get(r.id)?.input ?? 0,
      cell: (r) => {
        const price = priceById.get(r.id);
        return <span className="num">{price && price.input > 0 ? usd(price.input) : "—"}</span>;
      },
    },
    {
      key: "retailOut",
      header: "Retail out",
      align: "right",
      sortValue: (r) => priceById.get(r.id)?.output ?? 0,
      cell: (r) => {
        const price = priceById.get(r.id);
        return <span className="num">{price && price.output > 0 ? usd(price.output) : "—"}</span>;
      },
    },
    {
      key: "actual",
      header: "Actual %",
      align: "right",
      cell: (r) => {
        const costIn = Number(r.costIn) || 0;
        const retailIn = priceById.get(r.id)?.input ?? 0;
        const actual = costIn > 0 && retailIn > 0 ? (retailIn / costIn - 1) * 100 : null;
        return (
          <span
            className="num"
            style={actual !== null && actual < 0 ? { color: "#b91c1c" } : undefined}
          >
            {actual === null ? "—" : `${actual.toFixed(1)}%`}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHead
        title="Margin"
        sub="Upstream cost per 1M tokens, markup over cost, and the resulting retail price."
        side={
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => save(false)}
              disabled={saving}
            >
              Save costs
            </button>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => save(true)}
              disabled={saving}
            >
              {saving ? "Saving…" : "Apply margin → prices"}
            </button>
          </span>
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
        <DataTable
          columns={columns}
          rows={costRows}
          rowKey={(r) => r.id}
          searchText={(r) => r.id}
          searchPlaceholder="Search model"
          pageSize={25}
          empty="No models on any channel"
        />
      </div>
    </>
  );
}
