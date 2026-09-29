"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Copy } from "lucide-react";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";
import { Select } from "@/components/ui/select";
import { setLocale, type Locale } from "@/components/site/I18n";
import { usd } from "@/lib/money";

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

/**
 * The daily check-in calendar.
 *
 * The gateway keeps one record per checked day; this lays them over the current
 * month so the visitor can see what has been claimed. The reward is randomised
 * by the gateway, so only the resulting totals are shown.
 */
function CheckinCard({ initial }: { initial: CheckinData }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!status.enabled) {
    return <p className="note">Daily check-in is not enabled on this instance.</p>;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const checked = new Set(status.records.map((record) => record.date));
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const iso = (day: number) => `${month}-${String(day).padStart(2, "0")}`;

  const claim = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/profile/checkin", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { awardedUsd?: number; message?: string }
        | null;
      if (!response.ok) {
        setError(payload?.message || "Could not check in.");
        return;
      }
      setStatus((current) => ({
        ...current,
        checkedInToday: true,
        monthCount: current.monthCount + 1,
        totalCheckins: current.totalCheckins + 1,
        records: [...current.records, { date: iso(now.getDate()), quotaAwarded: 0 }],
      }));
      setNotice(`Checked in — ${usd(payload?.awardedUsd ?? 0)} added.`);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="note" style={{ marginBottom: 12 }}>
        {status.totalCheckins} check-ins all time · {status.monthCount} this month · total{" "}
        {usd(status.totalQuota / 500_000)} earned.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const on = checked.has(iso(day));
          const today = day === now.getDate();
          return (
            <span
              key={day}
              className={`chip${on ? " is-on" : ""}`}
              title={on ? `Checked in on ${iso(day)}` : iso(day)}
              style={today ? { borderColor: "var(--d-amber-deep)" } : undefined}
            >
              {on ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
              {day}
            </span>
          );
        })}
      </div>
      <button
        className="btn btn-primary btn-sm"
        type="button"
        disabled={busy || status.checkedInToday}
        onClick={claim}
      >
        {status.checkedInToday ? "Checked in today" : busy ? "Checking in…" : "Check in"}
      </button>
      {error ? (
        <p className="note" style={{ marginTop: 10, color: "#b91c1c" }} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="note" style={{ marginTop: 10, color: "#0e6b45" }} role="status">
          {notice}
        </p>
      ) : null}
    </>
  );
}

/**
 * The account profile: who you are, and the credentials that identify you.
 *
 * Editing the display name, username and language is one call; changing the
 * password is a separate one because the gateway requires the current password
 * to authorise it.
 */
export function ProfileView({
  initial,
  checkin,
}: {
  initial: ProfileData;
  checkin: CheckinData | null;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [language, setLanguage] = useState<Locale>(
    (initial.language as Locale) || "vi",
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, username, language }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        setError(payload?.message || "Could not save the profile.");
        return;
      }
      setProfile((p) => ({ ...p, displayName, username, language }));
      setLocale(language);
      setNotice("Profile saved.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
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
        setError(payload?.message || "Could not change the password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (payload?.relogin) {
        // The old session cannot renew, so it is ended deliberately rather than
        // left to fail on the next request.
        await fetch("/api/session/logout", { method: "POST" }).catch(() => {});
        window.location.href = "/?signedout=1";
        return;
      }

      setNotice("Password changed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const referralLink = profile.affiliateCode
    ? `https://vipai.site/?aff=${profile.affiliateCode}`
    : "";

  return (
    <>
      <PageHead
        title="Profile"
        sub="Your account details, sign-in preferences and credentials."
      />

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "#b91c1c" }} role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "#0e6b45" }} role="status">
          {notice}
        </div>
      ) : null}

      <SectionTitle hint={`id ${profile.id}`}>Account</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
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
            <span className="note" style={{ display: "block", marginBottom: 6 }}>
              Language
            </span>
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

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={saveProfile}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          <Pill tone="role">Group: {profile.group}</Pill>
          {profile.hasPassword ? null : <Pill tone="off">No password set</Pill>}
        </div>
      </div>

      <SectionTitle hint="Requires your current password">Change password</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
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
          <SectionTitle hint="Share this link to earn credit">Referrals</SectionTitle>
          <div className="panel" style={{ padding: 18 }}>
            <p className="note">
              Your affiliate code is <b>{profile.affiliateCode}</b>. New accounts that
              sign up through your link are tracked to you.
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
    </>
  );
}
