import { NextResponse } from "next/server";
import { GatewayError, getUser, login, persistSession } from "@/server/gateway";
import { toClientUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Signs in against the gateway and stores the session server-side.
 *
 * The credential is the gateway's `username`, not an email address: new-api
 * authenticates by username, and an account may have no email at all.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "missing_credentials", message: "Enter your username and password." },
      { status: 422 },
    );
  }

  try {
    const session = await login(username, password);
    await persistSession(session);
    const user = await getUser(session.accessToken);
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Incorrect username or password." },
        { status: 401 },
      );
    }
    if (error instanceof GatewayError && error.status === 429) {
      return NextResponse.json(
        { error: "rate_limited", message: error.message },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "sign_in_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
