"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser's view of the session.
 *
 * This replaced `limen-auth`, which spoke to a Go auth library that no longer
 * exists: it called `GET /me`, `/sessions` and `/:provider/authorize` under
 * `/auth`, and the gateway has no `/auth` routes at all — every one of those
 * paths answered with its single-page app's HTML. Auth is now the gateway's own
 * `/api/user/*`, reached through this app's `/api/session/*` routes so the
 * browser never has to hold a token or deal with the gateway's CORS.
 *
 * The state lives in a module-level store rather than a hook-local one, because
 * the nav, the user menu and the dashboard shell all read the same session and
 * must re-render together when it changes.
 */

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  /** new-api role: 1 user, 10 admin, 100 root. */
  role: number;
  /** Serialized sidebar-module preferences, or null when never set. */
  sidebarModules: string | null;
};

type State = {
  user: SessionUser | null;
  status: "loading" | "ready";
};

let state: State = { user: null, status: "loading" };
let loaded = false;
let inflight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

/** Reads the session once and caches it. Concurrent callers share one request. */
function load(): Promise<void> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const body = response.ok
        ? ((await response.json()) as { user: SessionUser | null })
        : null;
      loaded = true;
      setState({ user: body?.user ?? null, status: "ready" });
    } catch {
      // A network failure is indistinguishable from signed out here, and the
      // next navigation retries.
      loaded = true;
      setState({ user: null, status: "ready" });
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Re-reads the session, ignoring the cache. Call after sign-in or sign-out. */
export function refreshSession(): Promise<void> {
  loaded = true;
  inflight = null;
  return load();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) void load();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): State {
  return state;
}

// A constant, so the server render and the first client render agree.
const PENDING: State = { user: null, status: "loading" };
function getServerSnapshot(): State {
  return PENDING;
}

type SignInResult = { error?: { message?: string } };

async function post(path: string, body: unknown): Promise<SignInResult> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: { message: "Could not reach the server. Check your connection." } };
  }

  const payload = (await response.json().catch(() => null)) as
    | { user?: SessionUser; message?: string }
    | null;

  if (!response.ok || !payload?.user) {
    return { error: { message: payload?.message || "Something went wrong." } };
  }

  loaded = true;
  setState({ user: payload.user, status: "ready" });
  return {};
}

export const signIn = {
  /** Signs in by username. The gateway has no email-based login. */
  credential: (input: { credential: string; password: string }) =>
    post("/api/session/login", {
      username: input.credential,
      password: input.password,
    }),

  /**
   * Social sign-in.
   *
   * The gateway supports Google OAuth, but it is switched off in this instance
   * (`google_oauth: false`), so offering it would only produce a dead redirect.
   * It is kept as a method so the button can call it and report why.
   */
  social: async (_input: { provider: string }): Promise<never> => {
    throw new Error("Social sign-in is not enabled on this instance.");
  },
};

export const signUp = {
  credential: (input: {
    username: string;
    email?: string;
    password: string;
  }) =>
    post("/api/session/register", {
      username: input.username,
      email: input.email ?? "",
      password: input.password,
    }),
};

/** Ends the session and clears the cached user. */
export async function signout(): Promise<void> {
  try {
    await fetch("/api/session/logout", { method: "POST" });
  } finally {
    loaded = true;
    setState({ user: null, status: "ready" });
  }
}

/** The session as a promise, for callers outside a component. */
export async function getSession(): Promise<{ user: SessionUser | null }> {
  await load();
  return { user: state.user };
}

/** Subscribes to the session. */
export function useSession(): {
  data: { user: SessionUser } | null;
  isPending: boolean;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    data: snapshot.user ? { user: snapshot.user } : null,
    isPending: snapshot.status === "loading",
  };
}
