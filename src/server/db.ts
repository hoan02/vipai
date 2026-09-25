import "server-only";

/**
 * The app is designed to open and run before any database is attached. When
 * `DATABASE_URL` is present the Prisma client is created lazily on first use;
 * when it is absent every repository falls back to bundled demo data.
 *
 * The client is loaded dynamically so that a project which has not run
 * `npm run db:generate` yet still boots (the generated client is only required
 * once a real database is configured).
 */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const globalForPrisma = globalThis as unknown as { aigiarePrisma?: AnyClient };

export async function getDb(): Promise<AnyClient | null> {
  if (!hasDatabase) return null;
  if (globalForPrisma.aigiarePrisma) return globalForPrisma.aigiarePrisma;

  try {
    const mod = await import("@prisma/client");
    const client = new mod.PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.aigiarePrisma = client;
    return client;
  } catch (error) {
    // Most commonly: `DATABASE_URL` is set but `prisma generate` has not run.
    // Degrade to demo data instead of failing the request.
    console.error("[aigiare] could not create the Prisma client, using demo data:", error);
    return null;
  }
}
