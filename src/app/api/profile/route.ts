import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { changePassword, getAffiliateCode, getUser, updateSelf } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/** The account's own profile, plus its affiliate code. */
export async function GET() {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [user, affiliateCode] = await Promise.all([
      getUser(token),
      getAffiliateCode(token).catch(() => ""),
    ]);

    return NextResponse.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      group: user.group,
      role: user.role,
      hasPassword: user.hasPassword,
      language: user.language,
      affiliateCode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "profile_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/**
 * Updates the editable profile fields, or changes the password.
 *
 * A password change needs the current password: it is exchanged for a scoped
 * security proof, which the gateway validates. Display name and username do not,
 * so the two paths are kept apart by which fields are present.
 */
export async function PUT(request: Request) {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const field = (name: string) =>
    typeof body[name] === "string" ? (body[name] as string).trim() : "";

  const currentPassword = field("currentPassword");
  const newPassword = field("newPassword");

  try {
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "weak_password", message: "Use at least 8 characters." },
          { status: 422 },
        );
      }
      if (!currentPassword) {
        return NextResponse.json(
          { error: "missing_current", message: "Enter your current password." },
          { status: 422 },
        );
      }

      const { accessToken: rotated } = await changePassword(token, currentPassword, newPassword);
      // This app's own cookie holds a refresh token that the password change
      // invalidates; the gateway only returns a fresh access token, which cannot
      // be renewed on its own. So the honest answer is that the session must be
      // re-established by signing in again.
      return NextResponse.json({ ok: true, relogin: true, rotatedToken: rotated });
    }

    const displayName = field("displayName");
    const username = field("username");
    const language = field("language");

    if (username && username.length < 3) {
      return NextResponse.json(
        { error: "invalid_username", message: "Usernames are at least 3 characters." },
        { status: 422 },
      );
    }

    await updateSelf(token, {
      displayName: displayName || undefined,
      username: username || undefined,
      language: language || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    const status = /password/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: "update_failed", message }, { status });
  }
}
