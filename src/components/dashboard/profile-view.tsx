"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gift,
  KeyRound,
  LayoutDashboard,
  Mail,
  Server,
  Webhook,
} from "lucide-react";
import { PageHead, Pill, SectionTitle, Stat } from "@/components/dashboard/kit";
import { Select } from "@/components/ui/select";
import { useLocale, type Locale } from "@/components/site/I18n";
import { refreshSession } from "@/lib/auth-client";
import { usd } from "@/lib/money";
import { SIDEBAR_SECTIONS, defaultSidebarModules, parseSidebarModules } from "@/lib/sidebar-modules";

export type ProfileData = {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  group: string;
  role: number;
  hasPassword: boolean;
  language: string | null;
  affiliateCode: string;
  quotaUsd: number;
  usedUsd: number;
  requestCount: number;
};

/** The subset of the check-in status the profile card renders. */
export type CheckinData = {
  enabled: boolean;
  totalQuota: number;
  totalCheckins: number;
  monthCount: number;
  checkedInToday: boolean;
  records: Array<{ date: string; quotaAwarded: number }>;
};

/** The notification and privacy preferences the settings card edits. */
export type ProfileSettings = {
  notifyType: string;
  quotaWarningThreshold: number;
  notificationEmail: string;
  webhookUrl: string;
  webhookSecret: string;
  barkUrl: string;
  gotifyUrl: string;
  gotifyToken: string;
  gotifyPriority: number;
  acceptUnsetModelRatioModel: boolean;
  recordIpLog: boolean;
  upstreamModelUpdateNotifyEnabled: boolean;
};

const NOTIFY_METHODS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "bark", label: "Bark", icon: Bell },
  { value: "gotify", label: "Gotify", icon: Server },
] as const;

const QUOTA_PER_USD = 500_000;

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

function initialOf(value: string): string {
  return (value.trim()[0] ?? "A").toUpperCase();
}

/* ---------- Header ---------- */

function ProfileHeader({ profile }: { profile: ProfileData }) {
  const display = profile.displayName || profile.username;
  return (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "18px 20px", flexWrap: "wrap" }}>
        <span
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            flex: "none",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            background: "linear-gradient(135deg, var(--d-amber-deep), var(--d-amber))",
          }}
        >
          {initialOf(display)}
        </span>
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{display}</h1>
            <Pill tone="role">{profile.role >= 10 ? "Admin" : "User"}</Pill>
            <Pill tone="cap">
              <i />
              ID {profile.id}
            </Pill>
          </div>
          <div className="note" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>@{profile.username}</span>
            {profile.email ? <span>{profile.email}</span> : null}
            {profile.group ? <span>Group {profile.group}</span> : null}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          borderTop: "1px dashed var(--d-dash)",
        }}
      >
        {[
          { label: "Balance", value: usd(profile.quotaUsd), hint: "remaining credit" },
          { label: "Total usage", value: usd(profile.usedUsd), hint: "lifetime, at list price" },
          { label: "API requests", value: profile.requestCount.toLocaleString(), hint: undefined },
        ].map((item, index) => (
          <div
            key={item.label}
            style={{
              padding: "14px 20px",
              borderRight: index < 2 ? "1px dashed var(--d-dash)" : undefined,
            }}
          >
            <span className="note" style={{ display: "block" }}>{item.label}</span>
            <div className="num" style={{ marginTop: 6, fontSize: 20, fontWeight: 600 }}>{item.value}</div>
            {item.hint ? (
              <span className="note" style={{ display: "block", marginTop: 4 }}>{item.hint}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Notification settings ---------- */

function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`chip${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      {checked ? "On" : "Off"}
    </button>
  );
}

function NotificationSettingsCard({
  initial,
  isAdmin,
}: {
  initial: ProfileSettings;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<ProfileSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not save the settings.");
        return;
      }
      toast.success("Settings saved.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span className="note" style={{ display: "block", marginBottom: 8 }}>Notification method</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {NOTIFY_METHODS.map((method) => {
          const I = method.icon;
          const on = settings.notifyType === method.value;
          return (
            <button
              key={method.value}
              type="button"
              className={`chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => update({ notifyType: method.value })}
              style={{ height: 34, gap: 6 }}
            >
              <I size={14} aria-hidden="true" /> {method.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label className="note" htmlFor="threshold" style={{ display: "block", marginBottom: 6 }}>
            Quota warning threshold
          </label>
          <input
            id="threshold"
            className="field"
            type="number"
            style={{ width: "100%" }}
            value={settings.quotaWarningThreshold}
            onChange={(e) => update({ quotaWarningThreshold: Number(e.target.value) || 0 })}
          />
          <span className="note" style={{ display: "block", marginTop: 6 }}>
            ≈ {usd(settings.quotaWarningThreshold / QUOTA_PER_USD)} — notify when the balance drops below this.
          </span>
        </div>

        {settings.notifyType === "email" ? (
          <div>
            <label className="note" htmlFor="notifyEmail" style={{ display: "block", marginBottom: 6 }}>
              Notification email
            </label>
            <input
              id="notifyEmail"
              className="field"
              type="email"
              style={{ width: "100%" }}
              placeholder="Leave empty to use the account email"
              value={settings.notificationEmail}
              onChange={(e) => update({ notificationEmail: e.target.value })}
            />
          </div>
        ) : null}

        {settings.notifyType === "webhook" ? (
          <>
            <div>
              <label className="note" htmlFor="webhookUrl" style={{ display: "block", marginBottom: 6 }}>
                Webhook URL
              </label>
              <input
                id="webhookUrl"
                className="field"
                type="url"
                style={{ width: "100%" }}
                placeholder="https://example.com/webhook"
                value={settings.webhookUrl}
                onChange={(e) => update({ webhookUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="note" htmlFor="webhookSecret" style={{ display: "block", marginBottom: 6 }}>
                Webhook secret
              </label>
              <input
                id="webhookSecret"
                className="field"
                type="password"
                style={{ width: "100%" }}
                value={settings.webhookSecret}
                onChange={(e) => update({ webhookSecret: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {settings.notifyType === "bark" ? (
          <div>
            <label className="note" htmlFor="barkUrl" style={{ display: "block", marginBottom: 6 }}>
              Bark push URL
            </label>
            <input
              id="barkUrl"
              className="field"
              type="url"
              style={{ width: "100%" }}
              placeholder="https://api.day.app/yourkey"
              value={settings.barkUrl}
              onChange={(e) => update({ barkUrl: e.target.value })}
            />
          </div>
        ) : null}

        {settings.notifyType === "gotify" ? (
          <>
            <div>
              <label className="note" htmlFor="gotifyUrl" style={{ display: "block", marginBottom: 6 }}>
                Gotify server URL
              </label>
              <input
                id="gotifyUrl"
                className="field"
                type="url"
                style={{ width: "100%" }}
                value={settings.gotifyUrl}
                onChange={(e) => update({ gotifyUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="note" htmlFor="gotifyToken" style={{ display: "block", marginBottom: 6 }}>
                Gotify application token
              </label>
              <input
                id="gotifyToken"
                className="field"
                type="password"
                style={{ width: "100%" }}
                value={settings.gotifyToken}
                onChange={(e) => update({ gotifyToken: e.target.value })}
              />
            </div>
            <div>
              <label className="note" htmlFor="gotifyPriority" style={{ display: "block", marginBottom: 6 }}>
                Message priority (0–10)
              </label>
              <input
                id="gotifyPriority"
                className="field"
                type="number"
                min={0}
                max={10}
                style={{ width: "100%" }}
                value={settings.gotifyPriority}
                onChange={(e) => update({ gotifyPriority: Number(e.target.value) || 0 })}
              />
            </div>
          </>
        ) : null}
      </div>

      <div style={{ borderTop: "1px dashed var(--d-dash)", marginTop: 18, paddingTop: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Accept unpriced models</b>
            <p className="note" style={{ marginTop: 3 }}>Allow using models without a configured price.</p>
          </div>
          <Toggle
            id="acceptUnset"
            checked={settings.acceptUnsetModelRatioModel}
            onChange={(v) => update({ acceptUnsetModelRatioModel: v })}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Record IP address</b>
            <p className="note" style={{ marginTop: 3 }}>Log the IP address on usage and error logs.</p>
          </div>
          <Toggle id="recordIp" checked={settings.recordIpLog} onChange={(v) => update({ recordIpLog: v })} />
        </div>

        {isAdmin ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <b style={{ fontSize: 13.5 }}>Upstream model update alerts</b>
              <p className="note" style={{ marginTop: 3 }}>
                Receive a summary when the scheduled model check finds upstream changes.
              </p>
            </div>
            <Toggle
              id="upstreamNotify"
              checked={settings.upstreamModelUpdateNotifyEnabled}
              onChange={(v) => update({ upstreamModelUpdateNotifyEnabled: v })}
            />
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
        <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </>
  );
}

/* ---------- Sidebar modules ---------- */

function SidebarModulesCard({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [config, setConfig] = useState(() => parseSidebarModules(initial));
  const [busy, setBusy] = useState(false);

  const toggleSection = (section: string, value: boolean) =>
    setConfig((c) => ({ ...c, [section]: { ...c[section], enabled: value } }));

  const toggleModule = (section: string, module: string, value: boolean) =>
    setConfig((c) => ({ ...c, [section]: { ...c[section], [module]: value } }));

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/profile/sidebar", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules: JSON.stringify(config) }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not save the sidebar settings.");
        return;
      }
      // Refresh the session so the shell re-reads the stored preferences.
      await refreshSession();
      toast.success("Sidebar updated.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="note" style={{ marginBottom: 14 }}>
        Hide the sections or entries you do not use. Anything hidden stays reachable by its own URL.
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        {SIDEBAR_SECTIONS.map((section) => {
          const enabled = config[section.key]?.enabled !== false;
          return (
            <div key={section.key} style={{ border: "1px solid var(--d-line)", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <b style={{ fontSize: 14 }}>{section.label}</b>
                  <p className="note" style={{ marginTop: 3 }}>{section.description}</p>
                </div>
                <Toggle id={`sec-${section.key}`} checked={enabled} onChange={(v) => toggleSection(section.key, v)} />
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 8,
                  opacity: enabled ? 1 : 0.5,
                }}
              >
                {section.modules.map((module) => {
                  const on = config[section.key]?.[module.key] !== false;
                  return (
                    <div
                      key={module.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        border: "1px solid var(--d-line)",
                        padding: "8px 10px",
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 13 }}>{module.label}</b>
                        <small className="note" style={{ display: "block" }}>{module.description}</small>
                      </span>
                      <Toggle
                        id={`mod-${section.key}-${module.key}`}
                        checked={on}
                        onChange={(v) => toggleModule(section.key, module.key, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={busy}
          onClick={() => setConfig(defaultSidebarModules())}
        >
          Reset to default
        </button>
      </div>
    </>
  );
}

/* ---------- Check-in ---------- */

function CheckinCard({ initial }: { initial: CheckinData }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  if (!status.enabled) {
    return <p className="note">Daily check-in is not enabled on this instance.</p>;
  }

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const checked = new Set(status.records.map((record) => record.date));
  const awardByDate = new Map(status.records.map((record) => [record.date, record.quotaAwarded]));

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const monthLabel = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
  const iso = (day: number) => `${monthLabel}-${String(day).padStart(2, "0")}`;
  const viewMonthQuota = status.records
    .filter((record) => record.date.startsWith(monthLabel))
    .reduce((total, record) => total + record.quotaAwarded, 0);

  const claim = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/profile/checkin", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { awardedUsd?: number; message?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not check in.");
        return;
      }
      setStatus((current) => ({
        ...current,
        checkedInToday: true,
        monthCount: current.monthCount + 1,
        totalCheckins: current.totalCheckins + 1,
        records: [...current.records, { date: todayKey, quotaAwarded: 0 }],
      }));
      toast.success(`Checked in — ${usd(payload?.awardedUsd ?? 0)} added.`);
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push({ day: null });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day });

  return (
    <>
      <div className="stats" style={{ marginBottom: 14 }}>
        <Stat label="Total check-ins" value={status.totalCheckins.toLocaleString()} />
        <Stat label="This month" value={usd(viewMonthQuota / QUOTA_PER_USD)} hint={`${monthLabel}`} />
        <Stat label="Total earned" value={usd(status.totalQuota / QUOTA_PER_USD)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <b style={{ fontSize: 14 }}>{monthLabel}</b>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }))
            }
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            aria-label="Next month"
            onClick={() =>
              setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }))
            }
          >
            <ChevronRight size={15} />
          </button>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4, marginBottom: 14 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="note" style={{ textAlign: "center", fontSize: 11 }}>
            {day}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (cell.day === null) return <span key={`blank-${index}`} />;
          const key = iso(cell.day);
          const on = checked.has(key);
          const isToday = key === todayKey;
          const award = awardByDate.get(key);
          return (
            <span
              key={key}
              className={`chip${on ? " is-on" : ""}`}
              title={on ? `${key} · +${usd((award ?? 0) / QUOTA_PER_USD)}` : key}
              style={{
                justifyContent: "center",
                borderColor: isToday ? "var(--d-amber-deep)" : undefined,
              }}
            >
              {on ? <CheckCircle2 size={12} aria-hidden="true" /> : null}
              {cell.day}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={busy || status.checkedInToday}
          onClick={claim}
        >
          {status.checkedInToday ? "Checked in today" : busy ? "Checking in…" : "Check in"}
        </button>
        <span className="note">One check-in per day; rewards are random.</span>
      </div>
    </>
  );
}

/* ---------- Page ---------- */

/**
 * The account profile: identity, preferences and credentials.
 *
 * Editing the display name, username and language is one call; the password and
 * the notification settings are separate because the gateway guards or rebuilds
 * different parts of the account for each.
 */
export function ProfileView({
  initial,
  checkin,
  settings,
  sidebarModules,
}: {
  initial: ProfileData;
  checkin: CheckinData | null;
  settings: ProfileSettings;
  sidebarModules: string | null;
}) {
  const router = useRouter();
  const path = usePathname() ?? "/dashboard/profile";
  const locale = useLocale();
  const [profile, setProfile] = useState(initial);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [language, setLanguage] = useState<Locale>((initial.language as Locale) || "vi");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAdmin = profile.role >= 10;

  const saveProfile = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, username, language }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not save the profile.");
        return;
      }
      setProfile((p) => ({ ...p, displayName, username, language }));
      // The saved preference is also the URL: navigate so the page the visitor
      // is looking at is in the language they just picked.
      if (language !== locale) router.replace(path, { locale: language });
      toast.success("Profile saved.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("The two new passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; relogin?: boolean }
        | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not change the password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (payload?.relogin) {
        await fetch("/api/session/logout", { method: "POST" }).catch(() => {});
        window.location.href = "/?signedout=1";
        return;
      }

      toast.success("Password changed.");
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const referralLink = useMemo(
    () => (profile.affiliateCode ? `https://vipai.site/?aff=${profile.affiliateCode}` : ""),
    [profile.affiliateCode],
  );

  return (
    <>
      <PageHead title="Profile" sub="Your account details, preferences and credentials." />

      <div style={{ marginTop: 20 }}>
        <ProfileHeader profile={profile} />
      </div>

      <SectionTitle hint={`id ${profile.id}`}>Account</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div>
            <label className="note" htmlFor="displayName" style={{ display: "block", marginBottom: 6 }}>
              Display name
            </label>
            <input
              id="displayName"
              className="field"
              style={{ width: "100%" }}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="note" htmlFor="username" style={{ display: "block", marginBottom: 6 }}>
              Username
            </label>
            <input
              id="username"
              className="field"
              style={{ width: "100%" }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="note" htmlFor="email" style={{ display: "block", marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              className="field"
              style={{ width: "100%" }}
              value={profile.email ?? "Not set"}
              readOnly
              disabled
            />
          </div>
          <div>
            <span className="note" style={{ display: "block", marginBottom: 6 }}>Language</span>
            <Select
              label="Language"
              block
              value={language}
              onChange={(next) => setLanguage(next as Locale)}
              options={[
                { value: "vi", label: "Tiếng Việt" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={saveProfile}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          <Pill tone="role">Group: {profile.group}</Pill>
          {profile.hasPassword ? null : <Pill tone="off">No password set</Pill>}
        </div>
      </div>

      <SectionTitle hint="Requires your current password">Change password</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label className="note" htmlFor="currentPassword" style={{ display: "block", marginBottom: 6 }}>
              Current password
            </label>
            <input
              id="currentPassword"
              className="field"
              style={{ width: "100%" }}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="note" htmlFor="newPassword" style={{ display: "block", marginBottom: 6 }}>
              New password
            </label>
            <input
              id="newPassword"
              className="field"
              style={{ width: "100%" }}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="note" htmlFor="confirmPassword" style={{ display: "block", marginBottom: 6 }}>
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              className="field"
              style={{ width: "100%" }}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          type="button"
          style={{ marginTop: 16 }}
          disabled={busy}
          onClick={savePassword}
        >
          {busy ? "Working…" : "Change password"}
        </button>
      </div>

      <SectionTitle hint="Alerts and preferences">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Bell size={17} /> Settings
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <NotificationSettingsCard initial={settings} isAdmin={isAdmin} />
      </div>

      <SectionTitle hint="Customize the navigation">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <LayoutDashboard size={17} /> Sidebar
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <SidebarModulesCard initial={sidebarModules} />
      </div>

      {checkin ? (
        <>
          <SectionTitle hint="Claim a reward once a day">Daily check-in</SectionTitle>
          <div className="panel" style={{ padding: 18 }}>
            <CheckinCard initial={checkin} />
          </div>
        </>
      ) : null}

      {profile.affiliateCode ? (
        <>
          <SectionTitle hint="Share this link to earn credit">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Gift size={17} /> Referrals
            </span>
          </SectionTitle>
          <div className="panel" style={{ padding: 18 }}>
            <p className="note">
              Your affiliate code is <b>{profile.affiliateCode}</b>. New accounts that sign up through
              your link are tracked to you.
            </p>
            <div className="conn-url" style={{ marginTop: 12 }}>
              <code>{referralLink}</code>
              <button
                className={`conn-copy${copied ? " copied" : ""}`}
                type="button"
                aria-label="Copy referral link"
                onClick={() => {
                  copyText(referralLink);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <SectionTitle hint="Read-only">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={17} /> Credentials
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <p className="note">
          {profile.hasPassword ? "A password is set." : "No password is set on this account."} Manage
          two-factor authentication, passkeys and sessions on the Security page.
        </p>
      </div>
    </>
  );
}
