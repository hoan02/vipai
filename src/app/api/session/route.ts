import { NextResponse } from "next/server";
import { clearSession, currentAccess, getUser, persistSession } from "@/server/gateway";
import { toClientUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * The signed-in user, for the session hook.
 *
 * Answers 401 with `user: null` rather than an error body when signed out: being
 * signed out is a normal state the UI renders, not a failure.
 */
export async function GET() {
  const access = await currentAccess();
  if (!access) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (access.renewed) {
    await persistSession(access.renewed);
  }

  try {
    return NextResponse.json({ user: toClientUser(await getUser(access.token)) });
  } catch {
    // The token was renewed but the gateway still rejected it, so the session is
    // no longer good. Clearing it stops every later request from retrying it.
    await clearSession();
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
