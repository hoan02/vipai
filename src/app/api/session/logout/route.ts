import { NextResponse } from "next/server";
import { clearSession, logout } from "@/server/gateway";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Signs out.
 *
 * The local cookie is what actually ends the session here, since it holds the
 * tokens. Telling the gateway is best effort: it invalidates the refresh token
 * server-side, but it authenticates that call with the access token, which may
 * already have expired. Either way the browser is left signed out.
 */
export async function POST() {
  const session = await readSession();
  if (session) {
    await logout(session);
  }
  await clearSession();
  return new NextResponse(null, { status: 204 });
}
