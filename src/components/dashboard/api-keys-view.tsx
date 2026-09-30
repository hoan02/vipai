"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { Apple, Check, ChevronDown, ChevronUp, Copy, Plus } from "lucide-react";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/components/site/I18n";
import { formatDate } from "@/lib/datetime";
import type { ApiKey } from "@/lib/dashboard-data";
import { usd } from "@/lib/money";

/** Protocol names, not prose: the same in every locale. */
const protocols = [
  { id: "openai", label: "OpenAI", path: "/v1" },
  { id: "anthropic", label: "Anthropic", path: "" },
  { id: "google", label: "Google", path: "" },
  { id: "typesafe", label: "TypeSafe (Jev)", path: "" },
] as const;

function WindowsMark() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
  const t = useTranslations("apiKeys");
  const [open, setOpen] = useState(true);
  const [protocol, setProtocol] = useState<(typeof protocols)[number]["id"]>("openai");
  const [copied, setCopied] = useState(false);
  const current = protocols.find((p) => p.id === protocol) ?? protocols[0];
  const baseUrl = `https://api.vipai.site${current.path}`;

  return (
    <div className="conn" data-i18n-skip>
      <div className="conn-hd">
        <b>{t("replaceBaseUrl")}</b>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <Link className="link" href="/docs/api-integration">
            {t("viewDocs")}
          </Link>
          <button
            className="conn-copy"
            type="button"
            aria-label={open ? t("collapse") : t("expand")}
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
              label={t("modelScope")}
              block
              value="all"
              onChange={() => {}}
              options={[
                { value: "all", label: t("allModels") },
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
                aria-label={t("copyBaseUrl")}
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
            <div className="conn-proto" role="tablist" aria-label={t("apiProtocol")}>
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
            <b>{t("downloadTitle")}</b>
            <small>{t("downloadSub")}</small>
            <div className="conn-btns">
              <Link className="btn btn-sm btn-mac" href="/download">
                <Apple size={15} /> {t("downloadMac")}
              </Link>
              <Link className="btn btn-sm btn-win" href="/download">
                <WindowsMark /> {t("downloadWindows")}
              </Link>
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
  const locale = useLocale();
  const t = useTranslations("apiKeys");
  const td = useTranslations("dash");
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
      toast.error(t("errName"));
      return;
    }

    setCreating(false);
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
        toast.error(data?.message || t("errCreate"));
        return;
      }

      setFresh(data.key);
      setKeys((k) => [data.record as ApiKey, ...k]);
      resetForm();
    } catch {
      toast.error(t("errServer"));
    } finally {
      setBusy(false);
    }
  };

  const visibleModels = modelFilter.trim()
    ? models.filter((m) => m.toLowerCase().includes(modelFilter.trim().toLowerCase()))
    : models;

  const revoke = async (key: ApiKey) => {
    if (!window.confirm(t("confirmRevoke", { name: key.name }))) return;

    setKeys((k) => k.filter((item) => item.id !== key.id));

    try {
      const response = await fetch(`/api/keys/${encodeURIComponent(key.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || t("errRevoke"));
      }
      toast.success(t("revoked"));
    } catch (err) {
      // Put the key back so the table keeps matching the backend.
      setKeys((k) => [key, ...k]);
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <Connector />

      <div style={{ marginTop: 24 }}>
        <PageHead
          title={
            <span className="dash-title-row">
              {t("title")}{" "}
              <Pill tone="cap">
                <i />
                {t("discountCap")}
              </Pill>
            </span>
          }
          sub={t("sub")}
        />
      </div>

      {fresh ? (
        <div className="panel" style={{ padding: 16, marginTop: 18 }}>
          <b style={{ fontSize: 14.5 }}>{t("newKey")}</b>
          <p className="note" style={{ marginTop: 4 }}>
            {t("copyNow")}
          </p>
          <div className="conn-url" style={{ marginTop: 10 }}>
            <code>{fresh}</code>
            <button
              className={`conn-copy${copiedKey === fresh ? " copied" : ""}`}
              type="button"
              aria-label={t("copyKey")}
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

      <SectionTitle hint={creating ? undefined : t("keyCount", { count: keys.length })}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          {t("yourKeys")}
          {!creating ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setCreating(true)}>
              <Plus size={15} /> {t("createKey")}
            </button>
          ) : null}
        </span>
      </SectionTitle>

      {creating ? (
        <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
          <label className="note" htmlFor="keyName" style={{ display: "block", marginBottom: 6 }}>
            {t("keyName")}
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              id="keyName"
              className="field"
              style={{ flex: "1 1 220px" }}
              placeholder={t("namePlaceholder")}
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              label={t("billingGroup")}
              value={group}
              onChange={setGroup}
              className="has-icon"
              style={{ flex: "0 1 170px", paddingLeft: 12 }}
              options={[
                { value: "", label: t("defaultGroup") },
                ...groups.map((g) => ({ value: g, label: g })),
              ]}
            />
            <Select
              label={t("expiry")}
              value={String(expiresInDays)}
              onChange={(next) => setExpiresInDays(Number(next) || 0)}
              style={{ flex: "0 1 190px" }}
              options={[
                { value: "0", label: t("neverExpires") },
                { value: "7", label: t("expiresIn", { days: 7 }) },
                { value: "30", label: t("expiresIn", { days: 30 }) },
                { value: "90", label: t("expiresIn", { days: 90 }) },
                { value: "365", label: t("expiresIn", { days: 365 }) },
              ]}
            />
          </div>

          <label className="note" htmlFor="keyIps" style={{ display: "block", margin: "12px 0 6px" }}>
            {t("allowedIps")} <span style={{ opacity: 0.7 }}>{t("allowedIpsHint")}</span>
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
            {t("modelAccess")} <span style={{ opacity: 0.7 }}>{t("modelAccessHint")}</span>
          </label>
          {models.length > 8 ? (
            <input
              id="keyModels"
              className="field"
              style={{ width: "100%", marginBottom: 8 }}
              placeholder={t("filterModels")}
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
              <span className="note">{t("noModels")}</span>
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
              {t("modelsSelected", { count: pickedModels.length })}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={create}>
              {busy ? t("creating") : t("createKey")}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("colKey")}</th>
                <th>{td("status")}</th>
                <th>{t("colGroup")}</th>
                <th>{t("colModels")}</th>
                <th>{t("colExpires")}</th>
                <th className="r">{t("colSpent")}</th>
                <th>{t("colCreated")}</th>
                <th className="r">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={8}>{t("empty")}</td>
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
                      <Pill tone={k.status === "active" ? "ok" : "off"}>
                        {td(`status${k.status === "active" ? "Active" : k.status === "expired" ? "Expired" : "Disabled"}`)}
                      </Pill>
                    </td>
                    <td>{k.group || t("groupDefault")}</td>
                    <td>
                      {k.models.length === 0 ? (
                        <span className="note">{t("allModels")}</span>
                      ) : (
                        <span className="note" title={k.models.join(", ")}>
                          {t("selected", { count: k.models.length })}
                        </span>
                      )}
                    </td>
                    <td>
                      {k.expiresAt ? formatDate(k.expiresAt, locale) : t("never")}
                    </td>
                    <td className="r num">{usd(k.usedUsd)}</td>
                    <td>{formatDate(k.created, locale)}</td>
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
                          {t("revoke")}
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
