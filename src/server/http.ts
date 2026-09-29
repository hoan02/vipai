import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

/**
 * Where the gateway lives.
 *
 * Auth and identity moved to new-api, which owns users, API keys, quota and
 * billing. This module no longer does any of the session work: the session is a
 * signed cookie this app issues and reads back (see `session.ts`), and the
 * gateway is called with a bearer token (see `gateway.ts`).
 *
 * The gateway has its own hostname, so the default is the gateway origin rather
 * than this site with a prefix. A bare prefix could not serve the gateway's
 * console, which is a single-page app that hardcodes its asset and API paths at
 * the root.
 */
const DEFAULT_BACKEND = "https://api.vipai.site";

/**
 * Hosts that never leave the machine or its private network.
 *
 * A server-side render legitimately calls the gateway over plain HTTP on the
 * compose network, where it is addressed by service name rather than by IP.
 * A bare hostname that is not one of the known internal names is refused,
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
  // The gateway itself, in the compose network. Addressed directly rather than
  // through Caddy: Caddy routes by Host header, and a server-side call carries
  // the service name as its host, so it would fall through to the site and
  // answer with HTML. The prefix that made Caddy necessary is gone with it.
  "new-api",
  // The front door, kept for callers that do want prefix routing.
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
 * A backend URL crossing a network boundary must be https, so private and
 * loopback destinations are the only ones permitted over plain HTTP. Parsed
 * once at module load so a malformed value fails the server at boot instead of
 * silently reaching for the public origin.
 */
const backendUrl = z
  .url()
  .refine((value) => value.startsWith("https://") || isInternalHost(value), {
    message: "must be https, except for loopback, private-range, or container-network hosts",
  })
  .parse(process.env.BACKEND_API_URL || DEFAULT_BACKEND);

/** Origin of the gateway. No trailing slash. */
export const BACKEND_URL: string = backendUrl;

/**
 * The originating client IP, from the proxy in front of this app.
 *
 * Forwarded so the gateway rate limits the real caller rather than this server,
 * which would otherwise make every visitor share one bucket.
 */
export async function getForwardedFor(): Promise<string> {
  try {
    const headerStore = await headers();
    return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * The public origin the browser used, taken from the proxy's forwarded headers.
 *
 * The tunnel terminates TLS and delivers plain HTTP to the cluster, so the URL
 * this server sees is internal (`http://web:3000`). Redirect URIs, though, must
 * be the public ones Google and the gateway both expect, so they are built from
 * `x-forwarded-proto` and the original host.
 */
export function publicOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "";
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
