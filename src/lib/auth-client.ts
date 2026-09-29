"use client";

import { useEffect } from "react";
import { create } from "zustand";

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
 * The state lives in a Zustand store rather than a hook-local one, because the
 * nav, the user menu and the dashboard shell all read the same session and must
 * re-render together when it changes. The store itself never persists: the
 * session is a server cookie, and caching a user across reloads would render a
 * signed-out visitor as signed in.
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

type Status = "loading" | "ready";

type SessionStore = {
  user: SessionUser | null;
  status: Status;
  setUser: (user: SessionUser | null) => void;
  setStatus: (status: Status) => void;
};

/**
 * The session store.
 *
 * Zustand rather than a hand-rolled listener set: `set` merges into the store
 * and notifies only the selectors whose slice changed, so the nav does not
 * re-render when the user menu's own open/closed state changes.
 */
export const useSessionStore = create<SessionStore>()((set) => ({
  user: null,
  status: "loading",
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
}));

let loaded = false;
let inflight: Promise<void> | null = null;

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
      useSessionStore.setState({ user: body?.user ?? null, status: "ready" });
    } catch {
      // A network failure is indistinguishable from signed out here, and the
      // next navigation retries.
      loaded = true;
      useSessionStore.setState({ user: null, status: "ready" });
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
  useSessionStore.setState({ user: payload.user, status: "ready" });
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
   * The provider is a custom OAuth provider on the gateway (Google, on this
   * instance). The app cannot build the authorize URL itself — it holds no
   * gateway credentials and the state token is minted by the gateway — so it
   * asks its own server for the URL and leaves the page for the provider. The
   * callback is handled at `/oauth/<provider>` and stores the session.
   */
  social: async ({ provider }: { provider: string }): Promise<void> => {
    let response: Response;
    try {
      response = await fetch(`/api/session/social/${encodeURIComponent(provider)}`, {
        cache: "no-store",
      });
    } catch {
      throw new Error("Could not reach the server. Check your connection.");
    }

    const body = (await response.json().catch(() => null)) as
      | { url?: string; message?: string }
      | null;

    if (!response.ok || !body?.url) {
      throw new Error(body?.message || "Could not start sign-in. Please try again.");
    }

    window.location.assign(body.url);
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
    useSessionStore.setState({ user: null, status: "ready" });
  }
}

/** The session as a promise, for callers outside a component. */
export async function getSession(): Promise<{ user: SessionUser | null }> {
  await load();
  return { user: useSessionStore.getState().user };
}

/** Subscribes to the session, loading it once on first mount. */
export function useSession(): {
  data: { user: SessionUser } | null;
  isPending: boolean;
} {
  const user = useSessionStore((state) => state.user);
  const status = useSessionStore((state) => state.status);

  // The store has no subscriber hook of its own, so the first component that
  // mounts the session kicks off the (deduped) read.
  useEffect(() => {
    if (!loaded) void load();
  }, []);

  return {
    data: user ? { user } : null,
    isPending: status === "loading",
  };
}
