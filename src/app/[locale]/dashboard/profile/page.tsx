import { requireAccount } from "@/server/auth";
import {
  getAffiliateCode,
  getCheckinStatus,
  getUser,
  QUOTA_PER_USD,
  type GatewayUser,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { ProfileView, type ProfileSettings } from "@/components/dashboard/profile-view";

export const dynamic = "force-dynamic";

/** Reads the notification/privacy preferences out of the settings blob. */
function notificationSettings(user: GatewayUser): ProfileSettings {
  const setting = user.settings;
  const text = (key: string) => (typeof setting[key] === "string" ? (setting[key] as string) : "");
  const numeric = (key: string, fallback: number) => {
    const value = Number(setting[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    notifyType: text("notify_type") || "email",
    quotaWarningThreshold: numeric("quota_warning_threshold", 500000),
    notificationEmail: text("notification_email"),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    barkUrl: text("bark_url"),
    gotifyUrl: text("gotify_url"),
    gotifyToken: text("gotify_token"),
    gotifyPriority: numeric("gotify_priority", 5),
    acceptUnsetModelRatioModel: setting.accept_unset_model_ratio_model === true,
    recordIpLog: setting.record_ip_log === true,
    upstreamModelUpdateNotifyEnabled: setting.upstream_model_update_notify_enabled === true,
  };
}

export default async function ProfilePage() {
  await requireAccount();
  const token = await requireAccessToken();

  const [user, affiliateCode, checkin] = await Promise.all([
    getUser(token),
    getAffiliateCode(token).catch(() => ""),
    getCheckinStatus(token).catch(() => null),
  ]);

  return (
    <ProfileView
      initial={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        group: user.group,
        role: user.role,
        hasPassword: user.hasPassword,
        language: user.language,
        affiliateCode,
        quotaUsd: user.quota / QUOTA_PER_USD,
        usedUsd: user.usedQuota / QUOTA_PER_USD,
        requestCount: user.requestCount,
      }}
      checkin={checkin}
      settings={notificationSettings(user)}
      sidebarModules={user.sidebarModules}
    />
  );
}
