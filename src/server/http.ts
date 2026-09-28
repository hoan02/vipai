import "server-only";
import { cookies, headers } from "next/headers";
import { z } from "zod";

/**
 * Transport-level concerns for talking to the Go backend: where it lives, and
 * how the caller's credentials travel with a request.
 */

/**
 * Parsed once at module load so a malformed value fails the server at boot
 * instead of silently falling back to localhost in production.
 */
// The auth/data backend is the new-api gateway, not the retired Encore app.
// It is same-origin behind Caddy under /_aigiare, so the default is this site's
// own origin with that prefix rather than a separate host: one hostname, one
// tunnel, and no cross-origin CORS negotiation for the cookie.
const DEFAULT_BACKEND = "https://aigiare.site/_aigiare";

/**
 * Hosts that never leave the machine or its private network.
 *
 * A server-side render legitimately calls the gateway over plain HTTP on the
 * compose network, where it is addressed by service name rather than by IP. A
 * bare hostname that is not one of the known internal names is still refused,
 * because it could resolve to anything.
 *
 * This Set and the two helpers below must stay *above* `backendUrl`. They are
 * called from its initializer, and a `const` referenced before its declaration
 * throws in the temporal dead zone. A `catch` around that call would swallow
 * the ReferenceError and report the URL as merely untrusted, which is how a
 * loopback address once failed validation and broke the build.
 */
const INTERNAL_HOSTS = new Set([
  "localhost",
  "::1",
  // Docker's alias for the host from inside a container.
  "host.docker.internal",
  // The gateway front door in the compose network. A bare service name only
  // resolves inside Docker, never on the public internet.
  "caddy",
]);

function isInternalHost(value: string): boolean {
  // Only URL parsing is guarded. Anything else in here must throw loudly.
  let hostname: string;
  try {
    hostname = new URL(value).hostname;
  } catch {
    return false;
  }
  return INTERNAL_HOSTS.has(hostname) || isPrivateIpv4(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Plain HTTP is allowed only to a loopback or private address.
 *
 * The previous rule was "https unless localhost", which was correct when the
 * backend was a separate Encore deployment on its own hostname. It is wrong now
 * that the gateway is same-origin: a server-side render may legitimately call
 * it over plain HTTP inside the compose network, and that never leaves the
 * host. The rule that actually matters is that a backend URL crossing a network
 * boundary must be https, so private and loopback destinations are permitted.
 */
const backendUrl = z
  .url()
  .refine((value) => value.startsWith("https://") || isInternalHost(value), {
    message: "must be https, except for loopback, private-range, or container-network hosts",
  })
  .parse(process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND);


/**
 * Base URL of the backend that owns auth and data — the new-api gateway.
 *
 * Requests carry the same session cookie the browser already has, because the
 * gateway is same-origin. Limen's `limen_session` cookie name is retained so a
 * cookie issued by either backend still resolves, which matters during the
 * transition off the Encore app.
 */
export const BACKEND_URL: string = backendUrl;

/** The session cookie Limen sets on sign-in. */
export const SESSION_COOKIE = "limen_session";

/**
 * Forwards the caller's credentials to the backend.
 *
 * The backend's auth handler accepts both the Limen session cookie and a bearer
 * token, so whichever the browser sent is passed straight through. Returns an
 * empty object outside a request scope.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const reqHeaders: Record<string, string> = {};
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (sessionCookie) {
      reqHeaders["cookie"] = `${SESSION_COOKIE}=${sessionCookie}`;
    }
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");
    if (authHeader) {
      reqHeaders["authorization"] = authHeader;
    }
  } catch {
    // cookies()/headers() are unavailable outside a request scope.
  }
  return reqHeaders;
}

/** True when the current request carries a session. */
export async function hasCredentials(): Promise<boolean> {
  const reqHeaders = await getAuthHeaders();
  return Boolean(reqHeaders["cookie"] || reqHeaders["authorization"]);
}

/**
 * The web app's own origin, as the browser would have sent it.
 *
 * Limen rejects any mutating request whose `Origin` (or `Referer`) is not in its
 * trusted-origin list, and a server-to-server fetch carries neither. Sending the
 * web app's origin keeps the CSRF check meaningful: only a request that really
 * came from this site, carrying this site's session cookie, passes.
 */
export async function getWebAppOrigin(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const origin = headerStore.get("origin");
    if (origin) return origin;

    const host = headerStore.get("host");
    if (!host) return null;

    const forwardedProto = headerStore.get("x-forwarded-proto");
    const isLocal = host.startsWith("localhost") || host.startsWith("127.");
    const protocol = forwardedProto ?? (isLocal ? "http" : "https");
    return `${protocol}://${host}`;
  } catch {
    return null;
  }
}

/**
 * Headers for a call to the auth API.
 *
 * Limen rejects mutating requests that carry no JSON content type, so
 * `content-type` is always sent, including on DELETE which has no body. The
 * `origin` header is what satisfies its trusted-origin check.
 */
export async function authApiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders()),
    "content-type": "application/json",
    accept: "application/json",
  };

  const origin = await getWebAppOrigin();
  if (origin) headers["origin"] = origin;

  return headers;
}

/**
 * The originating client IP, from the proxy in front of this app.
 *
 * The backend rate limits its public form endpoint by this value, so it has to be
 * the real address rather than this server's.
 */
export async function getForwardedFor(): Promise<string> {
  try {
    const headerStore = await headers();
    return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  } catch {
    return "";
  }
}
