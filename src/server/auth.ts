import "server-only";
import { cookies, headers } from "next/headers";

export type Account = {
  id: string;
  email: string | null;
  name: string | null;
};

const BACKEND_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

/**
 * Returns the signed-in Limen account verified via the Go backend.
 * Returns null when signed out.
 */
export async function getAccount(): Promise<Account | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("limen_session")?.value;
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");

    if (!sessionCookie && !authHeader) {
      return null;
    }

    const reqHeaders: Record<string, string> = {};
    if (sessionCookie) {
      reqHeaders["cookie"] = `limen_session=${sessionCookie}`;
    }
    if (authHeader) {
      reqHeaders["authorization"] = authHeader;
    }

    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: reqHeaders,
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const user = data?.user;
    if (!user || !user.id) {
      return null;
    }

    const userId = String(user.id);
    const email = (user.email as string) || null;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      (user.name as string) ||
      null;

    return { id: userId, email, name };
  } catch (error) {
    console.error("[aigiare] auth verification failed:", error);
    return null;
  }
}

/** Throws when there is no signed-in account; use in protected route handlers. */
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) throw new Error("Unauthorized");
  return account;
}
