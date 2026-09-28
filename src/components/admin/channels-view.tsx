"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { send } from "@/components/admin/lib";
import { PageHead, Pill } from "@/components/dashboard/kit";
import type { GatewayChannel } from "@/server/gateway";

export function ChannelsView({ initialChannels }: { initialChannels: GatewayChannel[] }) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    {
      key: "name",
      header: "Channel",
      sortValue: (c) => c.name,
      cell: (c) => (
        <span className="cell-main">
          <span>{c.name}</span>
          <small>type {c.type}</small>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <Pill tone={c.status === 1 ? "ok" : "off"}>{c.status === 1 ? "Enabled" : "Disabled"}</Pill>
      ),
    },
    {
      key: "group",
      header: "Group",
      cell: (c) => (
        <input
          className="field"
          style={{ width: 110 }}
          value={c.group}
          onChange={(e) => patch(c.id, { group: e.target.value })}
          aria-label={`Group for ${c.name}`}
        />
      ),
    },
    {
      key: "priority",
      header: "Priority",
      align: "right",
      sortValue: (c) => c.priority,
      cell: (c) => (
        <input
          className="field"
          type="number"
          style={{ width: 80, textAlign: "right" }}
          value={c.priority}
          onChange={(e) => patch(c.id, { priority: Number(e.target.value) })}
          aria-label={`Priority for ${c.name}`}
        />
      ),
    },
    {
      key: "weight",
      header: "Weight",
      align: "right",
      sortValue: (c) => c.weight,
      cell: (c) => (
        <input
          className="field"
          type="number"
          style={{ width: 80, textAlign: "right" }}
          value={c.weight}
          onChange={(e) => patch(c.id, { weight: Number(e.target.value) })}
          aria-label={`Weight for ${c.name}`}
        />
      ),
    },
    {
      key: "models",
      header: "Models",
      align: "right",
      sortValue: (c) => c.models.length,
      cell: (c) => <span className="num">{c.models.length}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (c) => (
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
      ),
    },
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
          searchText={(c) => `${c.name} ${c.group}`}
          searchPlaceholder="Search channel"
          empty="No channels"
        />
      </div>
    </>
  );
}
