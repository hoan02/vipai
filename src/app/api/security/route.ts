import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import {
  getAccessTokenStatus,
  getPasskeyStatus,
  getTwoFactorStatus,
  listOAuthBindings,
  listSessions,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/**
 * Everything on the security screen, in one call.
 *
 * Each probe is independent, so one unavailable feature (a gateway build
 * without passkeys, say) degrades to a default rather than failing the page.
 */
export async function GET() {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [sessions, twoFactor, accessToken, passkey, bindings] = await Promise.all([
      listSessions(token),
      getTwoFactorStatus(token).catch(() => ({ enabled: false, locked: false })),
      getAccessTokenStatus(token).catch(() => ({
        exists: false,
        tokenRef: "",
        createdAt: null,
        lastUsedAt: null,
        lastUsedIp: "",
      })),
      getPasskeyStatus(token).catch(() => ({ enabled: false })),
      listOAuthBindings(token).catch(() => []),
    ]);

    return NextResponse.json({
      sessions: sessions.map((session) => ({
        sid: session.sid,
        current: session.current,
        loginMethod: session.loginMethod,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.createdAt.toISOString(),
        lastActiveAt: session.lastActiveAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      })),
      twoFactor,
      accessToken: {
        exists: accessToken.exists,
        tokenRef: accessToken.tokenRef,
        createdAt: accessToken.createdAt?.toISOString() ?? null,
        lastUsedAt: accessToken.lastUsedAt?.toISOString() ?? null,
        lastUsedIp: accessToken.lastUsedIp,
      },
      passkey,
      bindings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "security_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
