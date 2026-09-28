import { requireAccount } from "@/server/auth";
import { getDashboardKeys } from "@/server/dashboard";
import { ApiKeysView } from "@/components/dashboard/api-keys-view";

export const dynamic = "force-dynamic";

export default async function DashboardApiKeysPage() {
  await requireAccount();
  const keys = await getDashboardKeys();
  return <ApiKeysView initialKeys={keys} />;
}
