import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, hasDatabase } from "./db";

export type Account = {
  id: string;
  email: string | null;
  name: string | null;
};

/**
 * Returns the signed-in Clerk account, mirroring it into the local `User`
 * table so usage rows have a foreign key. Returns null when signed out.
 */
export async function getAccount(): Promise<Account | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? null;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || null;

  if (hasDatabase) {
    const db = await getDb();
    if (db) {
      try {
        await db.user.upsert({
          where: { id: userId },
          create: { id: userId, email, name },
          update: { email, name },
        });
      } catch (error) {
        console.error("[aigiare] could not mirror user:", error);
      }
    }
  }

  return { id: userId, email, name };
}

/** Throws when there is no signed-in account; use in protected route handlers. */
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) throw new Error("Unauthorized");
  return account;
}
