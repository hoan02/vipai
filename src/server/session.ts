import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

/**
 * The browser's session, held server-side.
 *
 * The gateway's own cookies cannot be used for this. `new_api_has_session` and
 * `new_api_refresh` are SameSite=Strict, host-only for the gateway's hostname,
 * and — verified against rc.40 — they do not authenticate the management API at
 * all: a request carrying both still answers 401. Only a bearer token works.
 *
 * Its access token lives 15 minutes, and the refresh token that renews it is
 * delivered as a cookie on a path the browser will never send anywhere useful.
 * So the Next.js server keeps both values itself, in a cookie the browser holds
 * but cannot read, and renews on demand. The browser only ever talks to this
 * origin, which also sidesteps the gateway's CORS, which is unusable as
 * configured: it answers `Access-Control-Allow-Origin: *` together with
 * `Access-Control-Allow-Credentials: true`, a combination browsers reject.
 */

export const SESSION_COOKIE = "vipai_session";

/** Fifteen minutes, minus a margin so a token never expires mid-request. */
const REFRESH_MARGIN_MS = 60_000;

export type Session = {
  /** Bearer token for the gateway's management API. */
  accessToken: string;
  /** Renews the access token. Thirty days. */
  refreshToken: string;
  /** Epoch milliseconds at which `accessToken` stops working. */
  expiresAt: number;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. It signs the " +
        "session cookie; without it a restart would silently sign every user out.",
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Encodes a session as `payload.signature`, both base64url. */
function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/**
 * Decodes and verifies a cookie value, or returns null.
 *
 * The signature is compared in constant time. A malformed or unsigned value is
 * treated as no session rather than an error, so a tampered cookie is simply
 * signed out instead of breaking every page.
 */
function decode(value: string | undefined): Session | null {
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const provided = value.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    // Missing configuration: fail closed, but do not throw from a read.
    return null;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed?.accessToken !== "string" ||
      typeof parsed?.refreshToken !== "string" ||
      typeof parsed?.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

/** The current session, or null when signed out. */
export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  return decode(store.get(SESSION_COOKIE)?.value);
}

/** True when `session` needs renewing. */
export function needsRefresh(session: Session): boolean {
  return Date.now() >= session.expiresAt - REFRESH_MARGIN_MS;
}

/**
 * Cookie options shared by every write.
 *
 * `sameSite: "lax"` rather than "strict": a strict cookie is not sent when the
 * user arrives from an external link, so following a link to the dashboard would
 * show a signed-out page even while signed in. Lax still blocks cross-site
 * writes, which is the part that matters.
 *
 * `secure` follows the scheme the browser actually used, taken from the proxy's
 * `x-forwarded-proto`, rather than `NODE_ENV`. Behind the tunnel the external
 * scheme is https even though this server is reached over http, so NODE_ENV
 * alone would be right in production and wrong everywhere else — and a Secure
 * cookie issued over plain http is silently dropped, which is indistinguishable
 * from a session that never started.
 */
export async function cookieOptions(): Promise<{
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
}> {
  let secure = process.env.NODE_ENV === "production";

  try {
    const headerStore = await headers();
    const proto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto) secure = proto === "https";
  } catch {
    // Outside a request scope; the NODE_ENV default stands.
  }

  return { httpOnly: true, sameSite: "lax", secure, path: "/" };
}

/** Persists a session for `maxAgeSeconds` from now. */
export function serialize(session: Session): string {
  return encode(session);
}
