import { requireAccount } from "@/server/auth";
import {
  getAccessTokenStatus,
  getPasskeyStatus,
  getTwoFactorStatus,
  getUser,
  listOAuthBindings,
  listSessions,
  QUOTA_PER_USD,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { SecurityView } from "@/components/dashboard/security-view";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireAccount();
  const token = await requireAccessToken();

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

  return (
    <SecurityView
      initial={{
        profile: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          group: user.group,
          role: user.role,
          hasPassword: user.hasPassword,
          quotaUsd: user.quota / QUOTA_PER_USD,
          usedUsd: user.usedQuota / QUOTA_PER_USD,
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
          barkUrl:
            typeof user.settings.bark_url === "string" ? (user.settings.bark_url as string) : "",
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
      }}
    />
  );
}
