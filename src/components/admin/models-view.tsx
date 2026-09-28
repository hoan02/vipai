"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
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
    {
      key: "model",
      header: "Model",
      sortValue: (r) => r.modelName,
      cell: (r) => (
        <span className="cell-main">
          <span>{r.modelName}</span>
          <small>{r.id > 0 ? r.squareState || "metadata" : "no metadata"}</small>
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (r) => (
        <input
          className="field"
          style={{ width: 220 }}
          value={r.description}
          onChange={(e) => patch(r.modelName, { description: e.target.value })}
          aria-label={`Description for ${r.modelName}`}
        />
      ),
    },
    {
      key: "tags",
      header: "Tags",
      cell: (r) => (
        <input
          className="field"
          style={{ width: 140 }}
          value={r.tags}
          onChange={(e) => patch(r.modelName, { tags: e.target.value })}
          aria-label={`Tags for ${r.modelName}`}
        />
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      align: "right",
      cell: (r) => (
        <input
          className="field"
          type="number"
          style={{ width: 80, textAlign: "right" }}
          value={r.vendorId}
          onChange={(e) => patch(r.modelName, { vendorId: e.target.value })}
          aria-label={`Vendor for ${r.modelName}`}
        />
      ),
    },
    {
      key: "visible",
      header: "Visible",
      cell: (r) => (
        <select
          className="field"
          value={r.status}
          onChange={(e) => patch(r.modelName, { status: Number(e.target.value) })}
          aria-label={`Visibility for ${r.modelName}`}
        >
          <option value={1}>Visible</option>
          <option value={0}>Hidden</option>
        </select>
      ),
    },
    {
      key: "rule",
      header: "Match",
      cell: (r) => (
        <select
          className="field"
          value={r.nameRule}
          onChange={(e) => patch(r.modelName, { nameRule: Number(e.target.value) })}
          aria-label={`Match rule for ${r.modelName}`}
        >
          <option value={0}>Exact</option>
          <option value={1}>Prefix</option>
          <option value={2}>Contains</option>
          <option value={3}>Suffix</option>
        </select>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => save(r)}>
            Save
          </button>
          {r.id > 0 ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(r)}>
              Delete
            </button>
          ) : null}
        </span>
      ),
    },
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
          searchText={(r) => `${r.modelName} ${r.tags}`}
          searchPlaceholder="Search model or tag"
          pageSize={25}
          empty="No models"
        />
      </div>
    </>
  );
}
