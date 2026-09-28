"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead, Pill, SectionTitle, Stat } from "@/components/dashboard/kit";
import type { GatewayChannel } from "@/server/gateway";
import type { AdminStats, MarginConfig, ModelPrice } from "@/server/admin";

const usd = (value: number) => `$${value.toFixed(value >= 1 ? 2 : 4)}`;

/**
 * The admin surface.
 *
 * Two independent concerns: which channels route traffic (routing), and what
 * customers pay (pricing). Both write through this app's /api/admin/* routes,
 * which hold the root token server-side; the browser never sees it.
 */

type PriceRow = { id: string; input: string; output: string; cache: string; perCall: string };
type CostRow = { id: string; costIn: string; costOut: string; margin: string };
type RedemptionRow = {
  id: number;
  name: string;
  key: string;
  status: number;
  usd: number;
  expiredTime: number;
};
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

function toRows(prices: ModelPrice[]): PriceRow[] {
  return prices.map((price) => ({
    id: price.id,
    input: price.input > 0 ? String(price.input) : "",
    output: price.output > 0 ? String(price.output) : "",
    cache: price.cache !== null ? String(price.cache) : "",
    perCall: price.perCall !== null ? String(price.perCall) : "",
  }));
}

function toCostRows(costs: MarginConfig[]): CostRow[] {
  return costs.map((cost) => ({
    id: cost.id,
    costIn: cost.in > 0 ? String(cost.in) : "",
    costOut: cost.out > 0 ? String(cost.out) : "",
    margin: cost.margin > 0 ? String(Math.round(cost.margin * 10000) / 100) : "",
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
  initialCosts,
  stats,
}: {
  initialChannels: GatewayChannel[];
  initialPrices: ModelPrice[];
  initialCosts: MarginConfig[];
  stats: AdminStats;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [rows, setRows] = useState<PriceRow[]>(() => toRows(initialPrices));
  const [costRows, setCostRows] = useState<CostRow[]>(() => toCostRows(initialCosts));
  const [saving, setSaving] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setCostCell = (id: string, field: "costIn" | "costOut" | "margin", value: string) => {
    setCostRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const saveCosts = async (apply: boolean) => {
    const models = costRows.map((row) => ({
      id: row.id,
      in: Number(row.costIn) || 0,
      out: Number(row.costOut) || 0,
      margin: (Number(row.margin) || 0) / 100,
    }));
    setSavingCosts(true);
    setError(null);
    setNotice(null);
    const result = await send("/api/admin/margin", "PUT", { models, apply });
    setSavingCosts(false);
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(apply ? "Saved costs and repriced retail." : "Saved costs and margins.");
    if (apply) router.refresh();
  };

  /* --- redemption codes and accounts (loaded on demand) ------------------ */

  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [codeName, setCodeName] = useState("");
  const [codeUsd, setCodeUsd] = useState("10");
  const [codeCount, setCodeCount] = useState("1");
  const [userQuery, setUserQuery] = useState("");
  const [busyLists, setBusyLists] = useState(false);

  const loadLists = async (keyword = "") => {
    setBusyLists(true);
    const [r, u] = await Promise.all([
      fetch("/api/admin/redemptions", { cache: "no-store" }).then((res) =>
        res.ok ? res.json() : { items: [] },
      ),
      fetch(`/api/admin/users${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`, {
        cache: "no-store",
      }).then((res) => (res.ok ? res.json() : { items: [] })),
    ]);
    setRedemptions((r as { items?: RedemptionRow[] }).items ?? []);
    setUsers((u as { items?: UserRow[] }).items ?? []);
    setBusyLists(false);
  };

  useEffect(() => {
    void loadLists();
    // Load once; the search box reloads with a keyword.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCodes = async () => {
    setError(null);
    setNotice(null);
    setNewKeys([]);
    const result = await send("/api/admin/redemptions", "POST", {
      name: codeName,
      usd: Number(codeUsd),
      count: Number(codeCount),
    });
    if (result.message) {
      setError(result.message);
      return;
    }
    setNewKeys((result as { keys?: string[] }).keys ?? []);
    setNotice("Codes created.");
    void loadLists(userQuery);
  };

  const deleteCode = async (id: number) => {
    if (!window.confirm("Delete this code? This cannot be undone.")) return;
    setError(null);
    const result = await send(`/api/admin/redemptions/${id}`, "DELETE", {});
    if (result.message) {
      setError(result.message);
      return;
    }
    setRedemptions((current) => current.filter((row) => row.id !== id));
  };

  const runUserAction = async (
    id: number,
    action: "enable" | "disable" | "promote" | "demote" | "delete" | "add_quota",
  ) => {
    setError(null);
    setNotice(null);
    let usd: number | undefined;
    if (action === "add_quota") {
      const input = window.prompt("Add credit (USD). Use a negative value to deduct.", "10");
      if (input === null) return;
      usd = Number(input);
      if (!Number.isFinite(usd) || usd === 0) {
        setError("Enter a non-zero USD amount.");
        return;
      }
    }
    if (action === "delete" && !window.confirm("Delete this account permanently?")) return;
    const result = await send(`/api/admin/users/${id}`, "POST", { action, usd });
    if (result.message) {
      setError(result.message);
      return;
    }
    setNotice(`Done: ${action}.`);
    void loadLists(userQuery);
  };

  const setCell = (id: string, field: "input" | "output" | "cache" | "perCall", value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const savePrices = async () => {
    const models = rows
      .filter(
        (row) =>
          row.input.trim() !== "" || row.output.trim() !== "" || row.perCall.trim() !== "",
      )
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
                <th className="r">Per call</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={5}>No models on any channel</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="cell-main">
                        <span>{row.id}</span>
                        {row.input === "" && row.perCall === "" ? (
                          <small>unpriced — not routable</small>
                        ) : null}
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
                    <td className="r">
                      <input
                        className="field"
                        type="number"
                        step="0.0001"
                        min="0"
                        style={{ width: 110, textAlign: "right" }}
                        value={row.perCall}
                        onChange={(e) => setCell(row.id, "perCall", e.target.value)}
                        aria-label={`Per-call price for ${row.id}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle hint="Upstream cost USD per 1M · margin % over cost">
        Margin
      </SectionTitle>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => saveCosts(false)}
            disabled={savingCosts}
          >
            Save costs
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => saveCosts(true)}
            disabled={savingCosts}
          >
            {savingCosts ? "Saving…" : "Apply margin → prices"}
          </button>
        </div>
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Model</th>
                <th className="r">Cost in</th>
                <th className="r">Cost out</th>
                <th className="r">Margin %</th>
                <th className="r">Retail in</th>
                <th className="r">Retail out</th>
                <th className="r">Actual %</th>
              </tr>
            </thead>
            <tbody>
              {costRows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>No models on any channel</td>
                </tr>
              ) : (
                costRows.map((row) => {
                  const retail = rows.find((r) => r.id === row.id);
                  const costIn = Number(row.costIn) || 0;
                  const retailIn = retail ? Number(retail.input) || 0 : 0;
                  const actual =
                    costIn > 0 && retailIn > 0 ? (retailIn / costIn - 1) * 100 : null;
                  return (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td className="r">
                        <input
                          className="field"
                          type="number"
                          step="0.0001"
                          min="0"
                          style={{ width: 110, textAlign: "right" }}
                          value={row.costIn}
                          onChange={(e) => setCostCell(row.id, "costIn", e.target.value)}
                          aria-label={`Cost in for ${row.id}`}
                        />
                      </td>
                      <td className="r">
                        <input
                          className="field"
                          type="number"
                          step="0.0001"
                          min="0"
                          style={{ width: 110, textAlign: "right" }}
                          value={row.costOut}
                          onChange={(e) => setCostCell(row.id, "costOut", e.target.value)}
                          aria-label={`Cost out for ${row.id}`}
                        />
                      </td>
                      <td className="r">
                        <input
                          className="field"
                          type="number"
                          step="1"
                          min="0"
                          style={{ width: 90, textAlign: "right" }}
                          value={row.margin}
                          onChange={(e) => setCostCell(row.id, "margin", e.target.value)}
                          aria-label={`Margin for ${row.id}`}
                        />
                      </td>
                      <td className="r num">{retailIn > 0 ? `$${retailIn}` : "—"}</td>
                      <td className="r num">
                        {retail && Number(retail.output) > 0 ? `$${retail.output}` : "—"}
                      </td>
                      <td
                        className="r num"
                        style={actual !== null && actual < 0 ? { color: "#b91c1c" } : undefined}
                      >
                        {actual === null ? "—" : `${actual.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle hint={stats.costComplete ? "revenue − cost" : "cost incomplete"}>
        Statistics
      </SectionTitle>
      <div className="stats four" style={{ marginTop: 8 }}>
        <Stat label="Requests" value={stats.requests.toLocaleString()} />
        <Stat label="Revenue" value={usd(stats.revenueUsd)} />
        <Stat label="Cost" value={usd(stats.costUsd)} />
        <Stat label="Margin" value={usd(stats.marginUsd)} />
      </div>
      <div className="panel">
        <div
          className="panel-hd"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3>By model</h3>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Model</th>
                <th className="r">Requests</th>
                <th className="r">Tokens in</th>
                <th className="r">Tokens out</th>
                <th className="r">Revenue</th>
                <th className="r">Cost</th>
                <th className="r">Margin</th>
              </tr>
            </thead>
            <tbody>
              {stats.byModel.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>No usage recorded yet</td>
                </tr>
              ) : (
                stats.byModel.map((model) => (
                  <tr key={model.id}>
                    <td>{model.id}</td>
                    <td className="r num">{model.requests.toLocaleString()}</td>
                    <td className="r num">{model.tokensIn.toLocaleString()}</td>
                    <td className="r num">{model.tokensOut.toLocaleString()}</td>
                    <td className="r num">{usd(model.revenueUsd)}</td>
                    <td className="r num">{model.costUsd === null ? "—" : usd(model.costUsd)}</td>
                    <td
                      className="r num"
                      style={
                        model.marginUsd !== null && model.marginUsd < 0
                          ? { color: "#b91c1c" }
                          : undefined
                      }
                    >
                      {model.marginUsd === null ? "—" : usd(model.marginUsd)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ padding: "0 16px 12px" }}>
          Aggregated over {stats.sampled.toLocaleString()} of {stats.total.toLocaleString()} recent
          requests.
        </p>
      </div>

      <SectionTitle hint={`${redemptions.length} code(s)`}>Redemption codes</SectionTitle>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            className="field"
            placeholder="Label"
            value={codeName}
            onChange={(e) => setCodeName(e.target.value)}
            style={{ width: 160 }}
            aria-label="Code label"
          />
          <input
            className="field"
            type="number"
            min="1"
            step="1"
            value={codeUsd}
            onChange={(e) => setCodeUsd(e.target.value)}
            style={{ width: 120 }}
            aria-label="Credit USD"
          />
          <input
            className="field"
            type="number"
            min="1"
            max="100"
            step="1"
            value={codeCount}
            onChange={(e) => setCodeCount(e.target.value)}
            style={{ width: 90 }}
            aria-label="Count"
          />
          <button className="btn btn-primary btn-sm" type="button" onClick={createCodes}>
            Create codes
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => loadLists(userQuery)}
            disabled={busyLists}
          >
            Reload
          </button>
        </div>
        <p className="note" style={{ marginTop: 0 }}>
          Credit is in USD; a customer redeems the code at Top up. Creating codes needs payment
          compliance confirmed on the gateway.
        </p>
        {newKeys.length > 0 ? (
          <div className="panel" style={{ padding: 12, marginBottom: 12 }}>
            <b>New codes — copy now</b>
            <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{newKeys.join("\n")}</pre>
          </div>
        ) : null}
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Label</th>
                <th>Code</th>
                <th className="r">USD</th>
                <th>Status</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={5}>No codes</td>
                </tr>
              ) : (
                redemptions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <code>{row.key}</code>
                    </td>
                    <td className="r num">${row.usd.toFixed(2)}</td>
                    <td>
                      <span className={`pill ${row.status === 1 ? "pill-ok" : "pill-off"}`}>
                        {row.status === 1 ? "Unused" : row.status === 3 ? "Used" : "Disabled"}
                      </span>
                    </td>
                    <td className="r">
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => deleteCode(row.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle hint={`${users.length} shown`}>Accounts</SectionTitle>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            className="field"
            placeholder="Search username / email"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            style={{ width: 260 }}
            aria-label="Search users"
          />
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => loadLists(userQuery)}
            disabled={busyLists}
          >
            Search
          </button>
        </div>
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="r">Balance</th>
                <th className="r">Used</th>
                <th className="r">Requests</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>No accounts</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="cell-main">
                        <span>{user.username}</span>
                        <small>{user.email || "—"}</small>
                      </span>
                    </td>
                    <td>{user.role >= 100 ? "Root" : user.role >= 10 ? "Admin" : "User"}</td>
                    <td>
                      <span className={`pill ${user.status === 1 ? "pill-ok" : "pill-off"}`}>
                        {user.status === 1 ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="r num">${user.balanceUsd.toFixed(2)}</td>
                    <td className="r num">${user.usedUsd.toFixed(2)}</td>
                    <td className="r num">{user.requestCount.toLocaleString()}</td>
                    <td className="r">
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => runUserAction(user.id, "add_quota")}
                        >
                          +$
                        </button>
                        {user.status === 1 ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => runUserAction(user.id, "disable")}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => runUserAction(user.id, "enable")}
                          >
                            Enable
                          </button>
                        )}
                      </span>
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
