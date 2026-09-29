import "server-only";

import { redirect } from "next/navigation";
import { currentAccess, getUser, type GatewayUser } from "./gateway";

/** The signed-in account, as the pages need it. */
export type Account = {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  /** new-api role: 1 user, 10 admin, 100 root. */
  role: number;
  /** Serialized sidebar-module preferences, or null when never set. */
  sidebarModules: string | null;
};

function toAccount(user: GatewayUser): Account {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    name: user.displayName || user.username,
    role: user.role,
    sidebarModules: user.sidebarModules,
  };
}

/**
 * The shape the browser sees.
 *
 * Deliberately smaller than `Account`: quota and spend are read per page on the
 * server, so sending them to every page for the nav menu would be a number that
 * goes stale between renders.
 */
export type ClientUser = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  /** new-api role: 1 user, 10 admin, 100 root. Drives the Admin nav item. */
  role: number;
  /** Serialized sidebar-module preferences; the nav filters against it. */
  sidebarModules: string | null;
};

export function toClientUser(user: GatewayUser): ClientUser {
  const account = toAccount(user);
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    name: account.name ?? account.username,
    role: account.role,
    sidebarModules: account.sidebarModules,
  };
}

/**
 * The signed-in account, or null when signed out.
 *
 * Identity comes from the gateway's `/api/user/self`, resolved with the access
 * token this app holds. A token that has expired is renewed on the way, but the
 * renewed value cannot be written from here: a Server Component is not allowed
 * to set a cookie. Route handlers persist it, so a browsing session keeps its
 * token fresh through the API calls the dashboard already makes.
 */
export async function getAccount(): Promise<Account | null> {
  try {
    const access = await currentAccess();
    if (!access) return null;
    return toAccount(await getUser(access.token));
  } catch (error) {
    console.error("[vipai] session lookup failed:", error);
    return null;
  }
}

/** Throws when there is no signed-in account; use in route handlers. */
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) throw new Error("Unauthorized");
  return account;
}

/**
 * Sends a signed-out visitor to the auth dialog and back; use at the top of a
 * protected page.
 *
 * There is no sign-in page to redirect to: the dialog is mounted in the root
 * layout, so `?auth=` asks it to open on the home page while `?redirect_url=`
 * remembers the page that was wanted.
 *
 * Separate from `requireAccount` because a page should send the visitor
 * somewhere useful, while a route handler should answer 401 and let the caller
 * decide. `redirect` works by throwing, so the two cannot be the same function.
 */
export async function requireAccountOrRedirect(redirectTo = "/dashboard"): Promise<Account> {
  const account = await getAccount();
  if (!account) {
    redirect(`/?auth=signin&redirect_url=${encodeURIComponent(redirectTo)}`);
  }
  return account;
}
