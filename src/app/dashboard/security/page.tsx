import { requireAccount } from "@/server/auth";
import {
  getAccessTokenStatus,
  getPasskeyStatus,
  getTwoFactorStatus,
  listOAuthBindings,
  listSessions,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { SecurityView } from "@/components/dashboard/security-view";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireAccount();
  const token = await requireAccessToken();

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

  return (
    <SecurityView
      initial={{
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
      }}
    />
  );
}
