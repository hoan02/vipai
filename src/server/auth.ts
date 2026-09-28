import "server-only";

import { redirect } from "next/navigation";
import { currentAccess, getUser, type GatewayUser } from "./gateway";

/** The signed-in account, as the pages need it. */
export type Account = {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
};

function toAccount(user: GatewayUser): Account {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    name: user.displayName || user.username,
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
};

export function toClientUser(user: GatewayUser): ClientUser {
  const account = toAccount(user);
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    name: account.name ?? account.username,
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
    console.error("[aigiare] session lookup failed:", error);
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
 * Redirects to sign-in when signed out; use at the top of a protected page.
 *
 * Separate from `requireAccount` because a page should send the visitor
 * somewhere useful, while a route handler should answer 401 and let the caller
 * decide. `redirect` works by throwing, so the two cannot be the same function.
 */
export async function requireAccountOrRedirect(redirectTo = "/dashboard"): Promise<Account> {
  const account = await getAccount();
  if (!account) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`);
  }
  return account;
}
