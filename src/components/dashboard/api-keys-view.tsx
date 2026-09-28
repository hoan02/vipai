"use client";

import { useState } from "react";
import Link from "next/link";
import { Apple, Check, ChevronDown, ChevronUp, Copy, Plus } from "lucide-react";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";
import { Select } from "@/components/ui/select";
import type { ApiKey } from "@/lib/dashboard-data";
import { usd } from "@/lib/money";

const protocols = [
  { id: "openai", label: "OpenAI", path: "/v1" },
  { id: "anthropic", label: "Anthropic", path: "" },
  { id: "google", label: "Google", path: "" },
  { id: "typesafe", label: "TypeSafe (Jev)", path: "" },
] as const;

function WindowsMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.4v7.1H3zM11.6 4.2 21 3v8.5h-9.4zM3 12.5h7.5v7.1L3 18.5zM11.6 12.5H21V21l-9.4-1.3z" />
    </svg>
  );
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(ta);
}

function Connector() {
  const [open, setOpen] = useState(true);
  const [protocol, setProtocol] = useState<(typeof protocols)[number]["id"]>("openai");
  const [copied, setCopied] = useState(false);
  const current = protocols.find((p) => p.id === protocol) ?? protocols[0];
  const baseUrl = `https://api.aigiare.site${current.path}`;

  return (
    <div className="conn">
      <div className="conn-hd">
        <b>Replace the Base URL to connect</b>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <Link className="link" href="/docs/api-integration">
            View docs
          </Link>
          <button
            className="conn-copy"
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </span>
      </div>

      {open ? (
        <div className="conn-row">
          <div>
            <Select
              label="Model scope"
              block
              value="all"
              onChange={() => {}}
              options={[
                { value: "all", label: "All models" },
                { value: "claude", label: "Claude" },
                { value: "gpt", label: "GPT" },
                { value: "gemini", label: "Gemini" },
              ]}
            />
            <div className="conn-url" style={{ marginTop: 12 }}>
              <code>{baseUrl}</code>
              <button
                className={`conn-copy${copied ? " copied" : ""}`}
                type="button"
                aria-label="Copy base URL"
                onClick={() => {
                  copyText(baseUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div>
            <div className="conn-proto" role="tablist" aria-label="API protocol">
              {protocols.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={protocol === p.id}
                  className={protocol === p.id ? "is-on" : undefined}
                  onClick={() => setProtocol(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="conn-dl">
            <b>Download the AiGiare client for one-click setup</b>
            <small>Codex / Claude Code</small>
            <div className="conn-btns">
              <a className="btn btn-sm btn-mac" href="/download">
                <Apple size={15} /> Download macOS
              </a>
              <a className="btn btn-sm btn-win" href="/download">
                <WindowsMark /> Download for Windows
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ApiKeysView({
  initialKeys,
  groups = [],
  models = [],
}: {
  initialKeys: ApiKey[];
  /** Billing groups the account may use. Empty falls back to the default. */
  groups?: string[];
  /** Every model the account may call, for the allow-list picker. */
  models?: string[];
}) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [pickedModels, setPickedModels] = useState<string[]>([]);
  const [allowIps, setAllowIps] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setName("");
    setGroup("");
    setModelFilter("");
    setPickedModels([]);
    setAllowIps("");
    setExpiresInDays(0);
  };

  const create = async () => {
    const label = name.trim();
    if (label.length < 3 || label.length > 50) {
      setError("Give the key a name between 3 and 50 characters.");
      return;
    }

    setCreating(false);
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: label,
          group,
          models: pickedModels,
          allowIps,
          expiresInDays,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { key?: string; record?: ApiKey; message?: string }
        | null;

      if (!response.ok || !data?.key || !data.record) {
        setError(data?.message || "Could not create the key. Please try again.");
        return;
      }

      setFresh(data.key);
      setKeys((k) => [data.record as ApiKey, ...k]);
      resetForm();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const visibleModels = modelFilter.trim()
    ? models.filter((m) => m.toLowerCase().includes(modelFilter.trim().toLowerCase()))
    : models;

  const revoke = async (key: ApiKey) => {
    if (!window.confirm(`Revoke "${key.name}"? This cannot be undone.`)) return;

    setError(null);
    setKeys((k) => k.filter((item) => item.id !== key.id));

    try {
      const response = await fetch(`/api/keys/${encodeURIComponent(key.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || "Could not revoke the key.");
      }
    } catch (err) {
      // Put the key back so the table keeps matching the backend.
      setKeys((k) => [key, ...k]);
      setError((err as Error).message);
    }
  };

  return (
    <>
      <Connector />

      <div style={{ marginTop: 24 }}>
        <PageHead
          title={
            <span className="dash-title-row">
              API keys <Pill tone="cap"><i />Discount cap</Pill>
            </span>
          }
          sub="API keys are credentials for accessing the AiGiare API and carry full account permissions. Store them securely. Revoking a key is permanent."
        />
      </div>

      {fresh ? (
        <div className="panel" style={{ padding: 16, marginTop: 18 }}>
          <b style={{ fontSize: 14.5 }}>Your new key</b>
          <p className="note" style={{ marginTop: 4 }}>Copy it now — you won&apos;t be able to see it again.</p>
          <div className="conn-url" style={{ marginTop: 10 }}>
            <code>{fresh}</code>
            <button
              className={`conn-copy${copiedKey === fresh ? " copied" : ""}`}
              type="button"
              aria-label="Copy key"
              onClick={() => {
                copyText(fresh);
                setCopiedKey(fresh);
                window.setTimeout(() => setCopiedKey(null), 1400);
              }}
            >
              {copiedKey === fresh ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 18, color: "#b91c1c" }} role="alert">
          {error}
        </div>
      ) : null}

      <SectionTitle
        hint={creating ? undefined : `${keys.length} ${keys.length === 1 ? "key" : "keys"}`}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          Your keys
          {!creating ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setCreating(true)}>
              <Plus size={15} /> Create key
            </button>
          ) : null}
        </span>
      </SectionTitle>

      {creating ? (
        <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
          <label className="note" htmlFor="keyName" style={{ display: "block", marginBottom: 6 }}>
            Key name
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              id="keyName"
              className="field"
              style={{ flex: "1 1 220px" }}
              placeholder="e.g. Production"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              label="Billing group"
              value={group}
              onChange={setGroup}
              className="has-icon"
              style={{ flex: "0 1 170px", paddingLeft: 12 }}
              options={[
                { value: "", label: "Default group" },
                ...groups.map((g) => ({ value: g, label: g })),
              ]}
            />
            <Select
              label="Expiry"
              value={String(expiresInDays)}
              onChange={(next) => setExpiresInDays(Number(next) || 0)}
              style={{ flex: "0 1 190px" }}
              options={[
                { value: "0", label: "Never expires" },
                { value: "7", label: "Expires in 7 days" },
                { value: "30", label: "Expires in 30 days" },
                { value: "90", label: "Expires in 90 days" },
                { value: "365", label: "Expires in 365 days" },
              ]}
            />
          </div>

          <label className="note" htmlFor="keyIps" style={{ display: "block", margin: "12px 0 6px" }}>
            Allowed IPs <span style={{ opacity: 0.7 }}>— optional, comma separated. Empty means any.</span>
          </label>
          <input
            id="keyIps"
            className="field"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
            placeholder="203.0.113.7, 198.51.100.0/24"
            value={allowIps}
            onChange={(e) => setAllowIps(e.target.value)}
          />

          <label className="note" htmlFor="keyModels" style={{ display: "block", margin: "12px 0 6px" }}>
            Model access <span style={{ opacity: 0.7 }}>— none selected means every model.</span>
          </label>
          {models.length > 8 ? (
            <input
              id="keyModels"
              className="field"
              style={{ width: "100%", marginBottom: 8 }}
              placeholder="Filter models…"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
            />
          ) : null}
          <div
            style={{
              maxHeight: 176,
              overflowY: "auto",
              border: "1px solid var(--d-line)",
              borderRadius: 10,
              padding: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {visibleModels.length === 0 ? (
              <span className="note">No models match.</span>
            ) : (
              visibleModels.map((m) => {
                const on = pickedModels.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    className={on ? "chip is-on" : "chip"}
                    aria-pressed={on}
                    onClick={() =>
                      setPickedModels((p) => (on ? p.filter((x) => x !== m) : [...p, m]))
                    }
                  >
                    {m}
                  </button>
                );
              })
            )}
          </div>

          {pickedModels.length > 0 ? (
            <p className="note" style={{ marginTop: 8 }}>
              {pickedModels.length} model{pickedModels.length === 1 ? "" : "s"} selected.
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={create}>
              {busy ? "Creating…" : "Create key"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Key</th>
                <th>Status</th>
                <th>Group</th>
                <th>Models</th>
                <th>Expires</th>
                <th className="r">Spent</th>
                <th>Created at</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={8}>No API keys yet. Create one to get started.</td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <span className="cell-main">
                        <span>{k.name}</span>
                        <small className="num">{k.masked}</small>
                      </span>
                    </td>
                    <td>
                      <Pill tone={k.statusText === "Active" ? "ok" : "off"}>
                        {k.statusText}
                      </Pill>
                    </td>
                    <td>{k.group || "default"}</td>
                    <td>
                      {k.models.length === 0 ? (
                        <span className="note">All</span>
                      ) : (
                        <span className="note" title={k.models.join(", ")}>
                          {k.models.length} selected
                        </span>
                      )}
                    </td>
                    <td>
                      {k.expiresAt
                        ? new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(k.expiresAt))
                        : "Never"}
                    </td>
                    <td className="r num">{usd(k.usedUsd)}</td>
                    <td>{k.created}</td>
                    <td className="r">
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        {/* No enable/disable action: the gateway's API cannot
                            change a key's status. `status` is not writable
                            through PUT /api/token/, and targeting a key with
                            /api/token/batch deletes it rather than disabling
                            it. Revoking is the one state change that works. */}
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => revoke(k)}
                        >
                          Revoke
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
    </>
  );
}
