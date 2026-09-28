import { NextResponse } from "next/server";
import { GatewayError, getUser, login, persistSession, register } from "@/server/gateway";
import { toClientUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** The gateway enforces this minimum; checking here gives a specific message. */
const PASSWORD_MIN = 8;

/**
 * Creates an account and signs it in.
 *
 * Registering does not return a session, so this signs in immediately afterwards.
 * new-api stores no first or last name, so the form no longer collects them.
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
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!username) {
    return NextResponse.json(
      { error: "invalid_username", message: "Choose a username." },
      { status: 422 },
    );
  }
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json(
      {
        error: "weak_password",
        message: `Use at least ${PASSWORD_MIN} characters for your password.`,
      },
      { status: 422 },
    );
  }

  try {
    await register(username, password, email);
  } catch (error) {
    const message = (error as Error).message;
    if (error instanceof GatewayError && error.status === 429) {
      return NextResponse.json(
        { error: "rate_limited", message },
        { status: 429 },
      );
    }
    // The gateway reports a taken username through a message, not a status.
    const taken = /already exists|has been deleted/i.test(message);
    return NextResponse.json(
      { error: taken ? "username_taken" : "register_failed", message },
      { status: taken ? 409 : 502 },
    );
  }

  try {
    const session = await login(username, password);
    await persistSession(session);
    const user = await getUser(session.accessToken);
    return NextResponse.json({ user: toClientUser(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json(
        {
          error: "sign_in_after_register_failed",
          message: "Your account was created. Sign in to continue.",
        },
        { status: 502 },
      );
    }
    throw error;
  }
}
