"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { PageHead, Pill, SectionTitle } from "@/components/dashboard/kit";

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

export type TwoFactor = { enabled: boolean; locked: boolean };

export type AccessTokenInfo = {
  exists: boolean;
  tokenRef: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string;
};

export type SecurityData = {
  sessions: SessionRow[];
  twoFactor: TwoFactor;
  accessToken: AccessTokenInfo;
  passkey: { enabled: boolean };
  bindings: Array<{ providerId: number; provider: string; externalId: string }>;
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

/**
 * The account security screen.
 *
 * Sections: active sessions, two-factor authentication, the personal access
 * token, and the read-only binding summary (passkey, OAuth). Anything the
 * gateway guards asks for the password once and exchanges it for a scoped proof.
 */
export function SecurityView({ initial }: { initial: SecurityData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Per-section password / code input, so they do not bleed into each other.
  const [tokenPassword, setTokenPassword] = useState("");
  const [twoFAPassword, setTwoFAPassword] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const call = async (
    url: string,
    body: Record<string, unknown>,
    tag: string,
  ): Promise<Record<string, unknown> | null> => {
    setBusy(tag);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, {
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
    const payload = await call(
      "/api/security/actions",
      { action: "revoke-session", sid: session.sid },
      `revoke-${session.sid}`,
    );
    if (payload) {
      setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.sid !== session.sid) }));
      setNotice("Session revoked.");
    }
  };

  const revokeOthers = async () => {
    const payload = await call("/api/security/actions", { action: "revoke-others" }, "revoke-others");
    if (payload) {
      setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.current) }));
      setNotice("All other sessions signed out.");
    }
  };

  const generateToken = async () => {
    const payload = await call(
      "/api/security/actions",
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
      "/api/security/actions",
      { action: "revoke-access-token", password: tokenPassword },
      "revoke-token",
    );
    if (payload) {
      setTokenPassword("");
      setData((d) => ({
        ...d,
        accessToken: { exists: false, tokenRef: "", createdAt: null, lastUsedAt: null, lastUsedIp: "" },
      }));
      setNotice("Access token revoked.");
    }
  };

  const beginTwoFactor = async () => {
    const payload = await call(
      "/api/security/2fa",
      { action: "setup", password: twoFAPassword },
      "2fa-setup",
    );
    if (payload?.setup) {
      setSetup(payload.setup as TwoFactorSetup);
    }
  };

  const enableTwoFactor = async () => {
    if (!setup) return;
    const payload = await call(
      "/api/security/2fa",
      { action: "enable", flowToken: setup.flowToken, code: twoFACode },
      "2fa-enable",
    );
    if (payload) {
      setSetup(null);
      setTwoFACode("");
      setTwoFAPassword("");
      setData((d) => ({ ...d, twoFactor: { enabled: true, locked: false } }));
      setNotice("Two-factor authentication is on.");
    }
  };

  const disableTwoFactor = async () => {
    if (!window.confirm("Turn off two-factor authentication?")) return;
    const payload = await call(
      "/api/security/2fa",
      { action: "disable", password: twoFAPassword },
      "2fa-disable",
    );
    if (payload) {
      setTwoFAPassword("");
      setData((d) => ({ ...d, twoFactor: { enabled: false, locked: false } }));
      setNotice("Two-factor authentication is off.");
    }
  };

  return (
    <>
      <PageHead
        title="Security"
        sub="Sessions, two-factor authentication, and the credentials that reach your account."
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
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={busy !== null}
            onClick={revokeOthers}
          >
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
              Two-factor authentication is enabled. Disabling it requires your password.
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
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={busy !== null}
                onClick={disableTwoFactor}
              >
                {busy === "2fa-disable" ? "Working…" : "Disable"}
              </button>
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
                  style={{ border: "1px solid var(--d-line)", borderRadius: 10 }}
                />
              ) : null}
              <div style={{ minWidth: 240 }}>
                <span className="note" style={{ display: "block" }}>Secret</span>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{setup.secret}</code>
                {setup.backupCodes.length > 0 ? (
                  <>
                    <span className="note" style={{ display: "block", marginTop: 12 }}>
                      Backup codes — store these somewhere safe
                    </span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 4,
                        fontFamily: "var(--font-mono)",
                        fontSize: 12.5,
                        marginTop: 6,
                      }}
                    >
                      {setup.backupCodes.map((backupCode) => (
                        <span key={backupCode}>{backupCode}</span>
                      ))}
                    </div>
                  </>
                ) : null}
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
              Add a second step to sign-in. You will need an authenticator app
              (Google Authenticator, 1Password, and similar).
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
          <>
            <p className="note">
              A token exists ({data.accessToken.tokenRef || "ref hidden"}
              {data.accessToken.lastUsedAt
                ? `, last used ${dateFmt.format(new Date(data.accessToken.lastUsedAt))}`
                : ", never used"}
              ). Generating a new one replaces it.
            </p>
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
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={busy !== null}
                onClick={generateToken}
              >
                {busy === "gen-token" ? "Working…" : "Replace token"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={busy !== null}
                onClick={revokeToken}
              >
                Revoke
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="note">
              Create a token to call the API on your own behalf, without signing in
              through the browser. It requires your password to generate.
            </p>
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
                {busy === "gen-token" ? "Working…" : "Generate token"}
              </button>
            </div>
          </>
        )}
      </div>

      <SectionTitle hint="Read-only">Other sign-in methods</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <span className="note">
            Passkey: {data.passkey.enabled ? "registered" : "not registered"}
          </span>
          <span className="note">
            Linked accounts:{" "}
            {data.bindings.length === 0
              ? "none"
              : data.bindings.map((b) => b.provider).join(", ")}
          </span>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          Passkeys and linked OAuth accounts are managed in the gateway console,
          where the browser handshake is supported.
        </p>
      </div>
    </>
  );
}
