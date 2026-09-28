"use client";

import { useEffect, useState } from "react";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead } from "@/components/dashboard/kit";
import type { GatewayModelMeta } from "@/server/gateway";

type ModelMetaRow = {
  id: number;
  modelName: string;
  description: string;
  tags: string;
  vendorId: string;
  status: number;
  nameRule: number;
  squareState: string;
};

function toRows(items: GatewayModelMeta[]): ModelMetaRow[] {
  return items.map((m) => ({
    id: m.id,
    modelName: m.modelName,
    description: m.description,
    tags: m.tags,
    vendorId: m.vendorId ? String(m.vendorId) : "",
    status: m.status,
    nameRule: m.nameRule,
    squareState: m.squareState,
  }));
}

export function ModelsView() {
  const [rows, setRows] = useState<ModelMetaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const helper = useColumnHelper<ModelMetaRow>();

  const load = async () => {
    setBusy(true);
    const response = await fetch("/api/admin/models", { cache: "no-store" });
    const data = (response.ok ? await response.json() : { items: [] }) as { items?: GatewayModelMeta[] };
    setRows(toRows(data.items ?? []));
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = (modelName: string, fields: Partial<ModelMetaRow>) =>
    setRows((current) =>
      current.map((row) => (row.modelName === modelName ? { ...row, ...fields } : row)),
    );

  const save = async (row: ModelMetaRow) => {
    setError(null);
    setNotice(null);
    const result = await send("/api/admin/models", row.id > 0 ? "PUT" : "POST", {
      id: row.id,
      modelName: row.modelName,
      description: row.description,
      tags: row.tags,
      vendorId: Number(row.vendorId) || 0,
      status: row.status,
      nameRule: row.nameRule,
    });
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(`Saved metadata for ${row.modelName}.`);
    void load();
  };

  const remove = async (row: ModelMetaRow) => {
    if (row.id <= 0) return;
    if (!window.confirm(`Delete metadata for ${row.modelName}?`)) return;
    setError(null);
    const result = await send(`/api/admin/models/${row.id}`, "DELETE", {});
    if (result.message) {
      setError(result.message);
      return;
    }
    patch(row.modelName, { id: 0, description: "", tags: "", status: 0 });
  };

  const columns: Column<ModelMetaRow>[] = [
    helper.accessor("modelName", {
      header: "Model",
      cell: (info) => (
        <span className="cell-main">
          <span>{info.getValue()}</span>
          <small>
            {info.row.original.id > 0 ? info.row.original.squareState || "metadata" : "no metadata"}
          </small>
        </span>
      ),
    }),
    helper.display({
      id: "description",
      header: "Description",
      cell: ({ row }) => (
        <input
          className="field"
          style={{ width: 220 }}
          value={row.original.description}
          onChange={(e) => patch(row.original.modelName, { description: e.target.value })}
          aria-label={`Description for ${row.original.modelName}`}
        />
      ),
    }),
    helper.display({
      id: "tags",
      header: "Tags",
      cell: ({ row }) => (
        <input
          className="field"
          style={{ width: 140 }}
          value={row.original.tags}
          onChange={(e) => patch(row.original.modelName, { tags: e.target.value })}
          aria-label={`Tags for ${row.original.modelName}`}
        />
      ),
    }),
    helper.display({
      id: "vendor",
      header: "Vendor",
      meta: { align: "right" },
      cell: ({ row }) => (
        <input
          className="field"
          type="number"
          style={{ width: 80, textAlign: "right" }}
          value={row.original.vendorId}
          onChange={(e) => patch(row.original.modelName, { vendorId: e.target.value })}
          aria-label={`Vendor for ${row.original.modelName}`}
        />
      ),
    }),
    helper.display({
      id: "visible",
      header: "Visible",
      cell: ({ row }) => (
        <select
          className="field"
          value={row.original.status}
          onChange={(e) => patch(row.original.modelName, { status: Number(e.target.value) })}
          aria-label={`Visibility for ${row.original.modelName}`}
        >
          <option value={1}>Visible</option>
          <option value={0}>Hidden</option>
        </select>
      ),
    }),
    helper.display({
      id: "rule",
      header: "Match",
      cell: ({ row }) => (
        <select
          className="field"
          value={row.original.nameRule}
          onChange={(e) => patch(row.original.modelName, { nameRule: Number(e.target.value) })}
          aria-label={`Match rule for ${row.original.modelName}`}
        >
          <option value={0}>Exact</option>
          <option value={1}>Prefix</option>
          <option value={2}>Contains</option>
          <option value={3}>Suffix</option>
        </select>
      ),
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => save(row.original)}>
            Save
          </button>
          {row.original.id > 0 ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(row.original)}>
              Delete
            </button>
          ) : null}
        </span>
      ),
    }),
  ];

  return (
    <>
      <PageHead
        title="Models"
        sub="Descriptions, tags, visibility and match rule for the model catalog."
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
        <p className="note" style={{ marginBottom: 12 }}>
          Vendor IDs are optional (no vendors are configured yet). A model with no metadata row is
          created on Save.
        </p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.modelName}
          searchPlaceholder="Search model or tag"
          pageSize={25}
          empty="No models"
        />
      </div>
    </>
  );
}
