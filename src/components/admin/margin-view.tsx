"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";
import type { MarginConfig, ModelPrice } from "@/server/admin";

type CostRow = {
  id: string;
  name: string;
  ctx: string;
  featured: boolean;
  costIn: string;
  costOut: string;
  margin: string;
  listIn: string;
  listOut: string;
};

function toCostRows(costs: MarginConfig[]): CostRow[] {
  return costs.map((cost) => ({
    id: cost.id,
    name: cost.name,
    ctx: cost.ctx,
    featured: cost.featured,
    costIn: cost.in > 0 ? String(cost.in) : "",
    costOut: cost.out > 0 ? String(cost.out) : "",
    margin: cost.margin > 0 ? String(Math.round(cost.margin * 10000) / 100) : "",
    listIn: cost.listIn > 0 ? String(cost.listIn) : "",
    listOut: cost.listOut > 0 ? String(cost.listOut) : "",
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

function textCell(
  value: string,
  onChange: (value: string) => void,
  label: string,
  width = 170,
): React.ReactNode {
  return (
    <input
      className="field"
      type="text"
      style={{ width }}
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
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const helper = useColumnHelper<CostRow>();

  const setCell = (id: string, field: "name" | "ctx" | "costIn" | "costOut" | "margin" | "listIn" | "listOut", value: string) =>
    setCostRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const setFeatured = (id: string, featured: boolean) =>
    setCostRows((current) => current.map((row) => (row.id === id ? { ...row, featured } : row)));

  const save = async (apply: boolean) => {
    const models = costRows.map((row) => ({
      id: row.id,
      in: Number(row.costIn) || 0,
      out: Number(row.costOut) || 0,
      margin: (Number(row.margin) || 0) / 100,
      name: row.name.trim(),
      ctx: row.ctx.trim(),
      featured: row.featured,
      listIn: Number(row.listIn) || 0,
      listOut: Number(row.listOut) || 0,
    }));
    setSaving(true);
    const result = await send("/api/admin/margin", "PUT", { models, apply });
    setSaving(false);
    if (result.message) {
      toast.error(result.message);
      return;
    }
    toast.success(
      apply ? "Saved, repriced retail, and wrote model metadata." : "Saved cost, margin and model metadata.",
    );
    if (apply) router.refresh();
  };

  const runImport = async () => {
    setImporting(true);
    const result = await send<{ meta?: number; cost?: number }>("/api/admin/models/import", "PUT", { meta: importText });
    setImporting(false);
    if (result.message) {
      toast.error(result.message);
      return;
    }
    const merged = result.data?.meta ?? 0;
    const costs = result.data?.cost ?? 0;
    toast.success(`Merged ${merged} models${costs > 0 ? ` and ${costs} cost rows` : ""}.`);
    setImportText("");
    router.refresh();
  };

  const priceById = new Map(initialPrices.map((price) => [price.id, price]));

  const columns: Column<CostRow>[] = [
    helper.accessor("id", { header: "Model" }),
    helper.display({
      id: "name",
      header: "Name",
      cell: ({ row }) => textCell(row.original.name, (v) => setCell(row.original.id, "name", v), `Name for ${row.original.id}`),
    }),
    helper.display({
      id: "ctx",
      header: "Context",
      cell: ({ row }) => textCell(row.original.ctx, (v) => setCell(row.original.id, "ctx", v), `Context for ${row.original.id}`, 80),
    }),
    helper.display({
      id: "featured",
      header: "Featured",
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.original.featured}
          onChange={(e) => setFeatured(row.original.id, e.target.checked)}
          aria-label={`Featured for ${row.original.id}`}
        />
      ),
    }),
    helper.display({
      id: "costIn",
      header: "Cost in",
      meta: { align: "right" },
      cell: ({ row }) =>
        costCell(row.original.costIn, (v) => setCell(row.original.id, "costIn", v), `Cost in for ${row.original.id}`),
    }),
    helper.display({
      id: "costOut",
      header: "Cost out",
      meta: { align: "right" },
      cell: ({ row }) =>
        costCell(row.original.costOut, (v) => setCell(row.original.id, "costOut", v), `Cost out for ${row.original.id}`),
    }),
    helper.display({
      id: "margin",
      header: "Margin %",
      meta: { align: "right" },
      cell: ({ row }) =>
        costCell(row.original.margin, (v) => setCell(row.original.id, "margin", v), `Margin for ${row.original.id}`, 90),
    }),
    helper.display({
      id: "listIn",
      header: "List in",
      meta: { align: "right" },
      cell: ({ row }) =>
        costCell(row.original.listIn, (v) => setCell(row.original.id, "listIn", v), `List price in for ${row.original.id}`),
    }),
    helper.display({
      id: "listOut",
      header: "List out",
      meta: { align: "right" },
      cell: ({ row }) =>
        costCell(row.original.listOut, (v) => setCell(row.original.id, "listOut", v), `List price out for ${row.original.id}`),
    }),
    helper.accessor((row) => priceById.get(row.id)?.input ?? 0, {
      id: "retailIn",
      header: "Retail in",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue() > 0 ? usd(info.getValue()) : "—"}</span>,
    }),
    helper.accessor((row) => priceById.get(row.id)?.output ?? 0, {
      id: "retailOut",
      header: "Retail out",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue() > 0 ? usd(info.getValue()) : "—"}</span>,
    }),
    helper.display({
      id: "actual",
      header: "Actual %",
      meta: { align: "right" },
      cell: ({ row }) => {
        const costIn = Number(row.original.costIn) || 0;
        const retailIn = priceById.get(row.original.id)?.input ?? 0;
        const actual = costIn > 0 && retailIn > 0 ? (retailIn / costIn - 1) * 100 : null;
        return (
          <span
            className="num"
            style={actual !== null && actual < 0 ? { color: "var(--danger)" } : undefined}
          >
            {actual === null ? "—" : `${actual.toFixed(1)}%`}
          </span>
        );
      },
    }),
  ];

  return (
    <>
      <PageHead
        title="Models"
        sub="Per model: display name, context, featured, upstream cost and markup, and the provider list price the public discount is measured against."
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

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Import model data</b>
            <p className="note" style={{ marginTop: 3 }}>
              Paste a map of <code>model id → {"{ name, ctx, featured, in, out }"}</code>, plus optional{" "}
              <code>costIn</code>, <code>costOut</code> and <code>margin</code>. Merged into the gateway options; models
              not in the paste are left alone.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setImportOpen((v) => !v)}>
            {importOpen ? "Hide" : "Paste JSON"}
          </button>
        </div>
        {importOpen ? (
          <>
            <textarea
              className="field"
              style={{ width: "100%", minHeight: 160, marginTop: 12, fontSize: 12.5, fontFamily: "monospace" }}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "gpt-5.6-sol": { "name": "GPT-5.6 Sol", "ctx": "1M", "featured": true, "in": 5, "out": 30 } }'
              spellCheck={false}
            />
            <div style={{ marginTop: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={runImport}
                disabled={importing || !importText.trim()}
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="panel" style={{ padding: 16, marginTop: 20 }}>
        <DataTable
          columns={columns}
          rows={costRows}
          rowKey={(r) => r.id}
          searchPlaceholder="Search model"
          pageSize={25}
          empty="No models on any channel"
          fixedHeight
        />
      </div>
    </>
  );
}
