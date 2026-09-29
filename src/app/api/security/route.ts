import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import {
  getAccessTokenStatus,
  getPasskeyStatus,
  getTwoFactorStatus,
  getUser,
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
    const [user, sessions, twoFactor, accessToken, passkey, bindings] = await Promise.all([
      getUser(token),
      listSessions(token),
      getTwoFactorStatus(token).catch(() => ({
        enabled: false,
        locked: false,
        backupCodesRemaining: null,
      })),
      getAccessTokenStatus(token).catch(() => ({
        exists: false,
        tokenRef: "",
        createdAt: null,
        lastUsedAt: null,
        lastUsedIp: "",
      })),
      getPasskeyStatus(token).catch(() => ({
        enabled: false,
        lastUsedAt: null,
        backupEligible: false,
        backupState: false,
      })),
      listOAuthBindings(token).catch(() => []),
    ]);

    return NextResponse.json({
      profile: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        group: user.group,
        role: user.role,
        hasPassword: user.hasPassword,
        quotaUsd: user.quota / 500_000,
        usedUsd: user.usedQuota / 500_000,
        requestCount: user.requestCount,
      },
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
      settings: {
        notifyType:
          typeof user.settings.notify_type === "string"
            ? (user.settings.notify_type as string)
            : "email",
        quotaWarningThreshold:
          Number(user.settings.quota_warning_threshold) > 0
            ? Number(user.settings.quota_warning_threshold)
            : 500000,
        notificationEmail:
          typeof user.settings.notification_email === "string"
            ? (user.settings.notification_email as string)
            : "",
        webhookUrl:
          typeof user.settings.webhook_url === "string" ? (user.settings.webhook_url as string) : "",
        webhookSecret:
          typeof user.settings.webhook_secret === "string"
            ? (user.settings.webhook_secret as string)
            : "",
        barkUrl: typeof user.settings.bark_url === "string" ? (user.settings.bark_url as string) : "",
        gotifyUrl:
          typeof user.settings.gotify_url === "string" ? (user.settings.gotify_url as string) : "",
        gotifyToken:
          typeof user.settings.gotify_token === "string" ? (user.settings.gotify_token as string) : "",
        gotifyPriority:
          Number(user.settings.gotify_priority) > 0 ? Number(user.settings.gotify_priority) : 5,
        acceptUnsetModelRatioModel: user.settings.accept_unset_model_ratio_model === true,
        recordIpLog: user.settings.record_ip_log === true,
        upstreamModelUpdateNotifyEnabled:
          user.settings.upstream_model_update_notify_enabled === true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "security_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
