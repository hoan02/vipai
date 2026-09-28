import "server-only";
import { hasCredentials } from "./http";
import { backend } from "./backend";
import { isAPIError } from "@/lib/backend-client";

export type Account = {
  id: string;
  email: string | null;
  name: string | null;
};

/**
 * Returns the signed-in account, or null when signed out.
 *
 * Identity comes from the backend's `/api/me`, which resolves the session through
 * Encore's auth handler. Do not read session state from cookies here.
 */
export async function getAccount(): Promise<Account | null> {
  try {
    if (!(await hasCredentials())) {
      return null;
    }

    const user = await backend().auth.Me();

    return {
      id: user.id,
      email: user.email || null,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    };
  } catch (error) {
    // 401 is the normal signed-out answer, so it is not worth logging.
    if (!isAPIError(error) || error.status !== 401) {
      console.error("[aigiare] session lookup failed:", error);
    }
    return null;
  }
}

/** Throws when there is no signed-in account; use in protected route handlers. */
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) throw new Error("Unauthorized");
  return account;
}
