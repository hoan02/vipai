"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";
import {
  buildRegistrationResult,
  createCredential,
  isPasskeySupported,
  prepareCredentialCreationOptions,
} from "@/lib/passkey";
import type { ProfileSettings } from "@/components/dashboard/profile-view";

export type SessionRow = {
  sid: string;
  current: boolean;
  loginMethod: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export type TwoFactor = { enabled: boolean; locked: boolean; backupCodesRemaining: number | null };

export type AccessTokenInfo = {
  exists: boolean;
  tokenRef: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string;
};

export type PasskeyInfo = {
  enabled: boolean;
  lastUsedAt: string | null;
  backupEligible: boolean;
  backupState: boolean;
};

export type SecurityProfile = {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  group: string;
  role: number;
  hasPassword: boolean;
  quotaUsd: number;
  usedUsd: number;
  requestCount: number;
};

export type SecurityData = {
  profile: SecurityProfile;
  sessions: SessionRow[];
  twoFactor: TwoFactor;
  accessToken: AccessTokenInfo;
  passkey: PasskeyInfo;
  bindings: Array<{ providerId: number; provider: string; externalId: string }>;
  settings: ProfileSettings;
};

type TwoFactorSetup = {
  secret: string;
  qrCodeData: string;
  backupCodes: string[];
  flowToken: string;
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

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** A short label for a browser user-agent, since the raw string is unreadable. */
function describeAgent(userAgent: string): string {
  if (!userAgent) return "Unknown client";
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("safari/")
          ? "Safari"
          : ua.includes("curl")
            ? "curl"
            : "Browser";
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("mac os")
      ? "macOS"
      : ua.includes("android")
        ? "Android"
        : ua.includes("iphone") || ua.includes("ipad")
          ? "iOS"
          : ua.includes("linux")
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Renders a set of newly issued secret strings (backup codes, a token). */
function SecretList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <>
      <span className="note" style={{ display: "block", marginTop: 12 }}>{label}</span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          marginTop: 6,
        }}
      >
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </>
  );
}

/**
 * The account security screen.
 *
 * Sections: sessions, two-factor authentication (with backup codes), the
 * personal access token, passkeys, linked OAuth accounts, and account deletion.
 * Anything the gateway guards asks for the password once and exchanges it for a
 * scoped proof.
 */
export function SecurityView({ initial }: { initial: SecurityData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tokenPassword, setTokenPassword] = useState("");
  const [twoFAPassword, setTwoFAPassword] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [passkeyPassword, setPasskeyPassword] = useState("");
  const [bindingPassword, setBindingPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [freshBackupCodes, setFreshBackupCodes] = useState<string[]>([]);
  const [unbindTarget, setUnbindTarget] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  // Detected after mount so the server render and first client render agree.
  const [passkeySupported, setPasskeySupported] = useState(false);
  useEffect(() => setPasskeySupported(isPasskeySupported()), []);

  const call = async (
    body: Record<string, unknown>,
    tag: string,
  ): Promise<Record<string, unknown> | null> => {
    setBusy(tag);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/security/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (!response.ok) {
        setError((payload?.message as string) || "The action failed.");
        return null;
      }
      return payload;
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const revokeSession = async (session: SessionRow) => {
    if (!window.confirm("Sign this session out?")) return;
    const payload = await call({ action: "revoke-session", sid: session.sid }, `revoke-${session.sid}`);
    if (payload) {
      setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.sid !== session.sid) }));
      setNotice("Session revoked.");
    }
  };

  const revokeOthers = async () => {
    const payload = await call({ action: "revoke-others" }, "revoke-others");
    if (payload) {
      setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.current) }));
      setNotice("All other sessions signed out.");
    }
  };

  const generateToken = async () => {
    const payload = await call(
      { action: "generate-access-token", password: tokenPassword },
      "gen-token",
    );
    if (payload?.token) {
      setFreshToken(String(payload.token));
      setTokenPassword("");
      setData((d) => ({ ...d, accessToken: { ...d.accessToken, exists: true } }));
    }
  };

  const revokeToken = async () => {
    if (!window.confirm("Revoke the personal access token?")) return;
    const payload = await call(
      { action: "revoke-access-token", password: tokenPassword },
      "revoke-token",
    );
    if (payload) {
      setTokenPassword("");
      setFreshToken(null);
      setData((d) => ({
        ...d,
        accessToken: { exists: false, tokenRef: "", createdAt: null, lastUsedAt: null, lastUsedIp: "" },
      }));
      setNotice("Access token revoked.");
    }
  };

  const beginTwoFactor = async () => {
    const payload = await call({ action: "setup", password: twoFAPassword }, "2fa-setup");
    if (payload?.setup) setSetup(payload.setup as TwoFactorSetup);
  };

  const enableTwoFactor = async () => {
    if (!setup) return;
    const payload = await call(
      { action: "enable", flowToken: setup.flowToken, code: twoFACode },
      "2fa-enable",
    );
    if (payload) {
      setSetup(null);
      setTwoFACode("");
      setTwoFAPassword("");
      setData((d) => ({
        ...d,
        twoFactor: { enabled: true, locked: false, backupCodesRemaining: d.twoFactor.backupCodesRemaining },
      }));
      setNotice("Two-factor authentication is on.");
    }
  };

  const disableTwoFactor = async () => {
    if (!window.confirm("Turn off two-factor authentication?")) return;
    const payload = await call({ action: "disable", password: twoFAPassword }, "2fa-disable");
    if (payload) {
      setTwoFAPassword("");
      setData((d) => ({ ...d, twoFactor: { enabled: false, locked: false, backupCodesRemaining: null } }));
      setNotice("Two-factor authentication is off.");
    }
  };

  const regenerateBackupCodes = async () => {
    const payload = await call(
      { action: "regenerate-backup-codes", password: backupPassword },
      "backup-codes",
    );
    if (payload?.backupCodes) {
      const codes = payload.backupCodes as string[];
      setFreshBackupCodes(codes);
      setBackupPassword("");
      setData((d) => ({ ...d, twoFactor: { ...d.twoFactor, backupCodesRemaining: codes.length } }));
      setNotice("New backup codes generated — store them now.");
    }
  };

  const registerPasskey = async () => {
    if (!isPasskeySupported()) {
      setError("This browser does not support passkeys.");
      return;
    }
    const begin = await call(
      { action: "passkey-register-begin", password: passkeyPassword },
      "passkey-begin",
    );
    if (!begin) return;

    const flowToken = String(begin.flowToken ?? "");
    if (!flowToken) {
      setError("The passkey registration flow expired. Try again.");
      return;
    }

    let credential: PublicKeyCredential | null = null;
    try {
      credential = (await createCredential(
        prepareCredentialCreationOptions(begin.options ?? begin),
      )) as PublicKeyCredential | null;
    } catch {
      setError("Passkey registration was cancelled.");
      return;
    }
    const attestation = buildRegistrationResult(credential);
    if (!attestation) {
      setError("The browser returned an invalid passkey response.");
      return;
    }

    const payload = await call(
      { action: "passkey-register-finish", flowToken, credential: attestation },
      "passkey-finish",
    );
    if (payload) {
      setPasskeyPassword("");
      setData((d) => ({ ...d, passkey: { ...d.passkey, enabled: true } }));
      setNotice("Passkey registered.");
    }
  };

  const removePasskey = async () => {
    if (!window.confirm("Remove the passkey? You will sign in with a password again.")) return;
    const payload = await call({ action: "passkey-delete", password: passkeyPassword }, "passkey-delete");
    if (payload) {
      setPasskeyPassword("");
      setData((d) => ({ ...d, passkey: { ...d.passkey, enabled: false, lastUsedAt: null } }));
      setNotice("Passkey removed.");
    }
  };

  const unbind = async () => {
    if (unbindTarget === null) return;
    const payload = await call(
      { action: "unbind-oauth", providerId: unbindTarget, password: bindingPassword },
      "unbind",
    );
    if (payload) {
      setData((d) => ({ ...d, bindings: d.bindings.filter((b) => b.providerId !== unbindTarget) }));
      setUnbindTarget(null);
      setBindingPassword("");
      setNotice("Account unlinked.");
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm.trim() !== data.profile.username) {
      setError("Type your username exactly to confirm deletion.");
      return;
    }
    if (!window.confirm("Delete this account permanently? This cannot be undone.")) return;
    const payload = await call({ action: "delete-account", password: deletePassword }, "delete-account");
    if (payload) {
      await fetch("/api/session/logout", { method: "POST" }).catch(() => {});
      window.location.href = "/?deleted=1";
    }
  };

  const togglePrivacy = async (value: boolean) => {
    setPrivacyBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data.settings, recordIpLog: value }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(payload?.message || "Could not save the setting.");
        return;
      }
      setData((d) => ({ ...d, settings: { ...d.settings, recordIpLog: value } }));
      setNotice("Setting saved.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPrivacyBusy(false);
    }
  };

  const lastUsed = data.passkey.lastUsedAt
    ? dateFmt.format(new Date(data.passkey.lastUsedAt))
    : "never";

  return (
    <>
      <PageHead
        title="Security"
        sub="Sign-in methods, sessions, and the credentials that reach your account."
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

      <SectionTitle
        hint={
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy !== null} onClick={revokeOthers}>
            Sign out other sessions
          </button>
        }
      >
        Active sessions
      </SectionTitle>
      <div className="panel">
        <div className="twrap">
          <table className="dtable compact">
            <thead>
              <tr>
                <th>Client</th>
                <th>Signed in</th>
                <th>Last active</th>
                <th>IP</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={5}>No active sessions.</td>
                </tr>
              ) : (
                data.sessions.map((session) => (
                  <tr key={session.sid}>
                    <td>
                      <span className="cell-main">
                        <span>{describeAgent(session.userAgent)}</span>
                        <small>
                          {session.loginMethod}
                          {session.current ? " · this device" : ""}
                        </small>
                      </span>
                    </td>
                    <td>{dateFmt.format(new Date(session.createdAt))}</td>
                    <td>{dateFmt.format(new Date(session.lastActiveAt))}</td>
                    <td className="num">{session.ip || "—"}</td>
                    <td className="r">
                      {session.current ? (
                        <Pill tone="ok">Current</Pill>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => revokeSession(session)}
                        >
                          Sign out
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle hint={data.twoFactor.enabled ? "On" : "Off"}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={17} /> Two-factor authentication
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        {data.twoFactor.enabled ? (
          <>
            <p className="note">
              Two-factor authentication is enabled
              {data.twoFactor.backupCodesRemaining !== null
                ? ` · ${data.twoFactor.backupCodesRemaining} backup codes remaining`
                : ""}
              . Disabling it requires your password.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              <input
                className="field"
                style={{ flex: "1 1 240px" }}
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={twoFAPassword}
                onChange={(e) => setTwoFAPassword(e.target.value)}
              />
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={busy !== null}
                onClick={disableTwoFactor}
              >
                {busy === "2fa-disable" ? "Working…" : "Disable"}
              </button>
            </div>

            <div style={{ borderTop: "1px dashed var(--d-dash)", marginTop: 16, paddingTop: 14 }}>
              <b style={{ fontSize: 13.5 }}>Backup codes</b>
              <p className="note" style={{ marginTop: 4 }}>
                Regenerate the single-use codes used when you lose your authenticator.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <input
                  className="field"
                  style={{ flex: "1 1 240px" }}
                  type="password"
                  placeholder="Current password"
                  autoComplete="current-password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={busy !== null || !backupPassword}
                  onClick={regenerateBackupCodes}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {busy === "backup-codes" ? "Working…" : "Regenerate"}
                </button>
              </div>
              <SecretList label="New backup codes — store them somewhere safe" values={freshBackupCodes} />
            </div>
          </>
        ) : setup ? (
          <>
            <p className="note">
              Scan the code with your authenticator app, then enter the six-digit code it shows.
            </p>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 14 }}>
              {setup.qrCodeData ? (
                // The data URI is produced by the gateway from the shared secret.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={setup.qrCodeData}
                  alt="Two-factor enrolment QR code"
                  width={168}
                  height={168}
                  style={{ border: "1px solid var(--d-line)" }}
                />
              ) : null}
              <div style={{ minWidth: 240 }}>
                <span className="note" style={{ display: "block" }}>Secret</span>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{setup.secret}</code>
                <SecretList label="Backup codes — store these somewhere safe" values={setup.backupCodes} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <input
                className="field"
                style={{ flex: "0 1 200px", fontFamily: "var(--font-mono)" }}
                placeholder="123456"
                inputMode="numeric"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={busy !== null}
                onClick={enableTwoFactor}
              >
                {busy === "2fa-enable" ? "Verifying…" : "Confirm and enable"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  setSetup(null);
                  setTwoFACode("");
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="note">
              Add a second step to sign-in. You will need an authenticator app (Google Authenticator,
              1Password, and similar).
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <input
                className="field"
                style={{ flex: "1 1 240px" }}
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={twoFAPassword}
                onChange={(e) => setTwoFAPassword(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={busy !== null}
                onClick={beginTwoFactor}
              >
                <Smartphone size={15} /> {busy === "2fa-setup" ? "Preparing…" : "Set up 2FA"}
              </button>
            </div>
          </>
        )}
      </div>

      <SectionTitle hint={data.accessToken.exists ? "Active" : "Not created"}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={17} /> Personal access token
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        {data.accessToken.exists ? (
          <p className="note">
            A token exists ({data.accessToken.tokenRef || "ref hidden"}
            {data.accessToken.lastUsedAt
              ? `, last used ${dateFmt.format(new Date(data.accessToken.lastUsedAt))}`
              : ", never used"}
            ). Generating a new one replaces it.
          </p>
        ) : (
          <p className="note">
            Create a token to call the API on your own behalf, without signing in through the browser.
            It requires your password to generate.
          </p>
        )}
        {freshToken ? (
          <div className="conn-url" style={{ marginTop: 12 }}>
            <code>{freshToken}</code>
            <button
              className={`conn-copy${copied ? " copied" : ""}`}
              type="button"
              aria-label="Copy access token"
              onClick={() => {
                copyText(freshToken);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input
            className="field"
            style={{ flex: "1 1 240px" }}
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={tokenPassword}
            onChange={(e) => setTokenPassword(e.target.value)}
          />
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy !== null}
            onClick={generateToken}
          >
            {busy === "gen-token" ? "Working…" : data.accessToken.exists ? "Replace token" : "Generate token"}
          </button>
          {data.accessToken.exists ? (
            <button className="btn btn-ghost btn-sm" type="button" disabled={busy !== null} onClick={revokeToken}>
              Revoke
            </button>
          ) : null}
        </div>
      </div>

      <SectionTitle hint={data.passkey.enabled ? "Registered" : "Not registered"}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Link2 size={17} /> Passkey login
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <p className="note">
          {data.passkey.enabled
            ? `A passkey is registered · last used ${lastUsed}. Removing it requires your password.`
            : "Register a passkey to sign in without typing your password."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input
            className="field"
            style={{ flex: "1 1 240px" }}
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={passkeyPassword}
            onChange={(e) => setPasskeyPassword(e.target.value)}
          />
          {data.passkey.enabled ? (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={busy !== null || !passkeyPassword}
              onClick={removePasskey}
            >
              {busy === "passkey-delete" ? "Working…" : "Remove passkey"}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={busy !== null || !passkeyPassword || !passkeySupported}
              title={passkeySupported ? undefined : "This browser does not support passkeys"}
              onClick={registerPasskey}
            >
              {busy === "passkey-begin" || busy === "passkey-finish" ? "Working…" : "Register passkey"}
            </button>
          )}
        </div>
      </div>

      <SectionTitle hint={`${data.bindings.length} linked`}>Linked accounts</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        {data.bindings.length === 0 ? (
          <p className="note">No external accounts are linked to this account.</p>
        ) : (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {data.bindings.map((binding) => (
                <li
                  key={binding.providerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    border: "1px solid var(--d-line)",
                    padding: "8px 12px",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13.5 }}>{binding.provider}</b>
                    <small className="note" style={{ display: "block" }}>{binding.externalId}</small>
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setUnbindTarget(binding.providerId);
                      setBindingPassword("");
                    }}
                  >
                    Unbind
                  </button>
                </li>
              ))}
            </ul>
            {unbindTarget !== null ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <input
                  className="field"
                  style={{ flex: "1 1 240px" }}
                  type="password"
                  placeholder="Current password to confirm"
                  autoComplete="current-password"
                  value={bindingPassword}
                  onChange={(e) => setBindingPassword(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={busy !== null || !bindingPassword}
                  onClick={unbind}
                >
                  {busy === "unbind" ? "Working…" : "Confirm unbind"}
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setUnbindTarget(null)}>
                  Cancel
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <SectionTitle hint="Privacy">Data handling</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Record IP address</b>
            <p className="note" style={{ marginTop: 3 }}>Store the IP address on usage and error logs.</p>
          </div>
          <button
            className={`chip${data.settings.recordIpLog ? " is-on" : ""}`}
            type="button"
            role="switch"
            aria-checked={data.settings.recordIpLog}
            disabled={privacyBusy}
            onClick={() => togglePrivacy(!data.settings.recordIpLog)}
          >
            {data.settings.recordIpLog ? "On" : "Off"}
          </button>
        </div>
      </div>

      <SectionTitle hint="Irreversible">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={17} /> Delete account
        </span>
      </SectionTitle>
      <div className="panel" style={{ padding: 18, borderColor: "color-mix(in srgb, #b91c1c 30%, transparent)" }}>
        <p className="note">
          Permanently deletes your account, keys and logs. Type your username to confirm.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input
            className="field"
            style={{ flex: "1 1 200px" }}
            placeholder={data.profile.username}
            aria-label="Type your username to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
          />
          <input
            className="field"
            style={{ flex: "1 1 220px" }}
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            style={{ color: "#b91c1c" }}
            disabled={busy !== null}
            onClick={deleteAccount}
          >
            <Trash2 size={14} aria-hidden="true" />
            {busy === "delete-account" ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </>
  );
}
