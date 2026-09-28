"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";
import type { GatewayChannel } from "@/server/gateway";
import type { ModelPrice } from "@/server/admin";

/**
 * The admin surface.
 *
 * Two independent concerns: which channels route traffic (routing), and what
 * customers pay (pricing). Both write through this app's /api/admin/* routes,
 * which hold the root token server-side; the browser never sees it.
 */

type PriceRow = { id: string; input: string; output: string; cache: string };

function toRows(prices: ModelPrice[]): PriceRow[] {
  return prices.map((price) => ({
    id: price.id,
    input: price.input > 0 ? String(price.input) : "",
    output: price.output > 0 ? String(price.output) : "",
    cache: price.cache !== null ? String(price.cache) : "",
  }));
}

async function send(path: string, method: string, body: unknown): Promise<{ message?: string }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { message: "Could not reach the server." };
  }
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    return { message: payload?.message || `Request failed (HTTP ${response.status}).` };
  }
  return {};
}

export function AdminView({
  initialChannels,
  initialPrices,
}: {
  initialChannels: GatewayChannel[];
  initialPrices: ModelPrice[];
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [rows, setRows] = useState<PriceRow[]>(() => toRows(initialPrices));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setCell = (id: string, field: "input" | "output" | "cache", value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const savePrices = async () => {
    const models = rows
      .filter((row) => row.input.trim() !== "" || row.output.trim() !== "")
      .map((row) => ({
        id: row.id,
        input: Number(row.input),
        output: Number(row.output),
        cache: row.cache.trim() === "" ? null : Number(row.cache),
      }));

    const invalid = models.find(
      (m) => !(m.input > 0) || !(m.output > 0) || Number.isNaN(m.input) || Number.isNaN(m.output),
    );
    if (invalid) {
      setError(`"${invalid.id}" needs a positive input and output price.`);
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

  const toggleChannel = async (channel: GatewayChannel) => {
    const enabled = channel.status !== 1;
    setError(null);
    setNotice(null);
    const result = await send(`/api/admin/channels/${channel.id}/status`, "POST", { enabled });
    if (result.message) {
      setError(result.message);
      return;
    }
    setChannels((current) =>
      current.map((c) => (c.id === channel.id ? { ...c, status: enabled ? 1 : 2 } : c)),
    );
  };

  const testChannel = async (channel: GatewayChannel) => {
    setError(null);
    setNotice(null);
    const result = (await send(`/api/admin/channels/${channel.id}/test`, "POST", {})) as {
      message?: string;
      timeMs?: number;
    };
    if (result.message) {
      setError(`Test failed for ${channel.name}: ${result.message}`);
      return;
    }
    setNotice(`${channel.name} responded in ${Math.round(result.timeMs ?? 0)} ms.`);
  };

  const saveChannel = async (channel: GatewayChannel) => {
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

  const patchChannel = (id: number, patch: Partial<GatewayChannel>) => {
    setChannels((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  return (
    <>
      <PageHead
        title="Admin"
        sub="Routing and pricing, applied to the gateway. Root account only."
        side={
          <button className="btn btn-primary btn-sm" type="button" onClick={savePrices} disabled={saving}>
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

      <SectionTitle hint={`${channels.length} channel(s)`}>Routing</SectionTitle>
      <div className="panel">
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Status</th>
                <th>Group</th>
                <th className="r">Priority</th>
                <th className="r">Weight</th>
                <th className="r">Models</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>No channels</td>
                </tr>
              ) : (
                channels.map((channel) => (
                  <tr key={channel.id}>
                    <td>
                      <span className="cell-main">
                        <span>{channel.name}</span>
                        <small>type {channel.type}</small>
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${channel.status === 1 ? "pill-ok" : "pill-off"}`}>
                        {channel.status === 1 ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <input
                        className="field"
                        style={{ width: 110 }}
                        value={channel.group}
                        onChange={(e) => patchChannel(channel.id, { group: e.target.value })}
                        aria-label={`Group for ${channel.name}`}
                      />
                    </td>
                    <td className="r">
                      <input
                        className="field"
                        type="number"
                        style={{ width: 80 }}
                        value={channel.priority}
                        onChange={(e) => patchChannel(channel.id, { priority: Number(e.target.value) })}
                        aria-label={`Priority for ${channel.name}`}
                      />
                    </td>
                    <td className="r">
                      <input
                        className="field"
                        type="number"
                        style={{ width: 80 }}
                        value={channel.weight}
                        onChange={(e) => patchChannel(channel.id, { weight: Number(e.target.value) })}
                        aria-label={`Weight for ${channel.name}`}
                      />
                    </td>
                    <td className="r num">{channel.models.length}</td>
                    <td className="r">
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => testChannel(channel)}>
                          Test
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => saveChannel(channel)}>
                          Save
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => toggleChannel(channel)}>
                          {channel.status === 1 ? "Disable" : "Enable"}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle hint="USD per 1M tokens · blank = not priced">
        Pricing
      </SectionTitle>
      <div className="panel">
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Model</th>
                <th className="r">Input</th>
                <th className="r">Output</th>
                <th className="r">Cache read</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={4}>No models on any channel</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="cell-main">
                        <span>{row.id}</span>
                        {row.input === "" ? <small>unpriced — not routable</small> : null}
                      </span>
                    </td>
                    <td className="r">
                      <input
                        className="field"
                        type="number"
                        step="0.0001"
                        min="0"
                        style={{ width: 110, textAlign: "right" }}
                        value={row.input}
                        onChange={(e) => setCell(row.id, "input", e.target.value)}
                        aria-label={`Input price for ${row.id}`}
                      />
                    </td>
                    <td className="r">
                      <input
                        className="field"
                        type="number"
                        step="0.0001"
                        min="0"
                        style={{ width: 110, textAlign: "right" }}
                        value={row.output}
                        onChange={(e) => setCell(row.id, "output", e.target.value)}
                        aria-label={`Output price for ${row.id}`}
                      />
                    </td>
                    <td className="r">
                      <input
                        className="field"
                        type="number"
                        step="0.0001"
                        min="0"
                        style={{ width: 110, textAlign: "right" }}
                        value={row.cache}
                        onChange={(e) => setCell(row.id, "cache", e.target.value)}
                        aria-label={`Cache read price for ${row.id}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
