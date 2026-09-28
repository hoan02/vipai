"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";
import { setLocale, type Locale } from "@/components/site/I18n";

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
 * The account profile: who you are, and the credentials that identify you.
 *
 * Editing the display name, username and language is one call; changing the
 * password is a separate one because the gateway requires the current password
 * to authorise it.
 */
export function ProfileView({ initial }: { initial: ProfileData }) {
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
        | { message?: string }
        | null;
      if (!response.ok) {
        setError(payload?.message || "Could not change the password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password changed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const referralLink = profile.affiliateCode
    ? `https://aigiare.site/?aff=${profile.affiliateCode}`
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
            <label className="note" htmlFor="language" style={{ display: "block", marginBottom: 6 }}>
              Language
            </label>
            <select
              id="language"
              className="field"
              style={{ width: "100%" }}
              value={language}
              onChange={(e) => setLanguage(e.target.value as Locale)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
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
