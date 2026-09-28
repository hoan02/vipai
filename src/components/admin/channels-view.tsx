"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead, Pill } from "@/components/dashboard/kit";
import type { GatewayChannel } from "@/server/gateway";

export function ChannelsView({ initialChannels }: { initialChannels: GatewayChannel[] }) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const helper = useColumnHelper<GatewayChannel>();

  const patch = (id: number, fields: Partial<GatewayChannel>) =>
    setChannels((current) => current.map((c) => (c.id === id ? { ...c, ...fields } : c)));

  const test = async (channel: GatewayChannel) => {
    setError(null);
    setNotice(null);
    const result = await send<{ timeMs?: number }>(
      `/api/admin/channels/${channel.id}/test`,
      "POST",
      {},
    );
    if (result.message) {
      setError(`Test failed for ${channel.name}: ${result.message}`);
      return;
    }
    setNotice(`${channel.name} responded in ${Math.round(result.data?.timeMs ?? 0)} ms.`);
  };

  const save = async (channel: GatewayChannel) => {
    setError(null);
    setNotice(null);
    const result = await send(`/api/admin/channels/${channel.id}`, "PATCH", {
      group: channel.group,
      priority: channel.priority,
      weight: channel.weight,
      models: channel.models.join(","),
    });
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(`Saved routing for ${channel.name}.`);
    router.refresh();
  };

  const toggle = async (channel: GatewayChannel) => {
    const enabled = channel.status !== 1;
    setError(null);
    setNotice(null);
    const result = await send(`/api/admin/channels/${channel.id}/status`, "POST", { enabled });
    if (result.message) {
      setError(result.message);
      return;
    }
    patch(channel.id, { status: enabled ? 1 : 2 });
  };

  const columns: Column<GatewayChannel>[] = [
    helper.accessor("name", {
      header: "Channel",
      cell: (info) => (
        <span className="cell-main">
          <span>{info.getValue()}</span>
          <small>type {info.row.original.type}</small>
        </span>
      ),
    }),
    helper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Pill tone={info.getValue() === 1 ? "ok" : "off"}>
          {info.getValue() === 1 ? "Enabled" : "Disabled"}
        </Pill>
      ),
    }),
    helper.display({
      id: "group",
      header: "Group",
      cell: ({ row }) => (
        <input
          className="field"
          style={{ width: 110 }}
          value={row.original.group}
          onChange={(e) => patch(row.original.id, { group: e.target.value })}
          aria-label={`Group for ${row.original.name}`}
        />
      ),
    }),
    helper.accessor("priority", {
      header: "Priority",
      meta: { align: "right" },
      cell: ({ row }) => (
        <input
          className="field"
          type="number"
          style={{ width: 80, textAlign: "right" }}
          value={row.original.priority}
          onChange={(e) => patch(row.original.id, { priority: Number(e.target.value) })}
          aria-label={`Priority for ${row.original.name}`}
        />
      ),
    }),
    helper.accessor("weight", {
      header: "Weight",
      meta: { align: "right" },
      cell: ({ row }) => (
        <input
          className="field"
          type="number"
          style={{ width: 80, textAlign: "right" }}
          value={row.original.weight}
          onChange={(e) => patch(row.original.id, { weight: Number(e.target.value) })}
          aria-label={`Weight for ${row.original.name}`}
        />
      ),
    }),
    helper.accessor((row) => row.models.length, {
      id: "models",
      header: "Models",
      meta: { align: "right" },
      cell: (info) => <span className="num">{info.getValue()}</span>,
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => {
        const c = row.original;
        return (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => test(c)}>
              Test
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => save(c)}>
              Save
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => toggle(c)}>
              {c.status === 1 ? "Disable" : "Enable"}
            </button>
          </span>
        );
      },
    }),
  ];

  return (
    <>
      <PageHead
        title="Channels"
        sub="Which upstreams route traffic, and how they are grouped and weighted."
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
          rows={channels}
          rowKey={(c) => String(c.id)}
          searchPlaceholder="Search channel"
          empty="No channels"
        />
      </div>
    </>
  );
}
