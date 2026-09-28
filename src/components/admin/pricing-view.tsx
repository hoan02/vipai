"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead } from "@/components/dashboard/kit";
import type { ModelPrice } from "@/server/admin";

type PriceRow = {
  id: string;
  input: string;
  output: string;
  cache: string;
  perCall: string;
};

function toRows(prices: ModelPrice[]): PriceRow[] {
  return prices.map((price) => ({
    id: price.id,
    input: price.input > 0 ? String(price.input) : "",
    output: price.output > 0 ? String(price.output) : "",
    cache: price.cache !== null ? String(price.cache) : "",
    perCall: price.perCall !== null ? String(price.perCall) : "",
  }));
}

function numberCell(
  value: string,
  onChange: (value: string) => void,
  label: string,
): React.ReactNode {
  return (
    <input
      className="field"
      type="number"
      step="0.0001"
      min="0"
      style={{ width: 110, textAlign: "right" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
  );
}

export function PricingView({ initialPrices }: { initialPrices: ModelPrice[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PriceRow[]>(() => toRows(initialPrices));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const helper = useColumnHelper<PriceRow>();

  const setCell = (id: string, field: "input" | "output" | "cache" | "perCall", value: string) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const save = async () => {
    const models = rows
      .filter((row) => row.input.trim() !== "" || row.output.trim() !== "" || row.perCall.trim() !== "")
      .map((row) => ({
        id: row.id,
        input: Number(row.input) || 0,
        output: Number(row.output) || 0,
        cache: row.cache.trim() === "" ? null : Number(row.cache),
        perCall: row.perCall.trim() === "" ? null : Number(row.perCall),
      }));

    const invalid = models.find((m) => {
      const tokenPriced = m.input > 0 && m.output > 0;
      const callPriced = m.perCall !== null && m.perCall > 0;
      return !tokenPriced && !callPriced;
    });
    if (invalid) {
      setError(`"${invalid.id}" needs a positive input and output price, or a per-call price.`);
      return;
    }
    if (models.length === 0) {
      setError("Set a price on at least one model.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await send("/api/admin/pricing", "PUT", { models });
    setSaving(false);
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(`Saved prices for ${models.length} model(s).`);
    router.refresh();
  };

  const columns: Column<PriceRow>[] = [
    helper.accessor("id", {
      header: "Model",
      cell: (info) => (
        <span className="cell-main">
          <span>{info.getValue()}</span>
          {info.row.original.input === "" && info.row.original.perCall === "" ? (
            <small>unpriced — not routable</small>
          ) : null}
        </span>
      ),
    }),
    helper.display({
      id: "input",
      header: "Input",
      meta: { align: "right" },
      cell: ({ row }) =>
        numberCell(row.original.input, (v) => setCell(row.original.id, "input", v), `Input price for ${row.original.id}`),
    }),
    helper.display({
      id: "output",
      header: "Output",
      meta: { align: "right" },
      cell: ({ row }) =>
        numberCell(row.original.output, (v) => setCell(row.original.id, "output", v), `Output price for ${row.original.id}`),
    }),
    helper.display({
      id: "cache",
      header: "Cache read",
      meta: { align: "right" },
      cell: ({ row }) =>
        numberCell(row.original.cache, (v) => setCell(row.original.id, "cache", v), `Cache price for ${row.original.id}`),
    }),
    helper.display({
      id: "perCall",
      header: "Per call",
      meta: { align: "right" },
      cell: ({ row }) =>
        numberCell(row.original.perCall, (v) => setCell(row.original.id, "perCall", v), `Per-call price for ${row.original.id}`),
    }),
  ];

  return (
    <>
      <PageHead
        title="Pricing"
        sub="What customers pay, in USD per 1M tokens (or per call for image models)."
        side={
          <button className="btn btn-primary btn-sm" type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save prices"}
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
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          searchPlaceholder="Search model"
          pageSize={25}
          empty="No models on any channel"
        />
      </div>
    </>
  );
}
