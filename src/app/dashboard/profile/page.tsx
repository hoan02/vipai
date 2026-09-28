import { requireAccount } from "@/server/auth";
import { getAffiliateCode, getUser } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { ProfileView } from "@/components/dashboard/profile-view";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireAccount();
  const token = await requireAccessToken();

  const [user, affiliateCode] = await Promise.all([
    getUser(token),
    getAffiliateCode(token).catch(() => ""),
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
      }}
    />
  );
}
