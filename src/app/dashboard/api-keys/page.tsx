import { requireAccount } from "@/server/auth";
import { getDashboardKeys } from "@/server/dashboard";
import { ApiKeysView } from "@/components/dashboard/api-keys-view";

export const dynamic = "force-dynamic";

export default async function DashboardApiKeysPage() {
  const account = await requireAccount();
  const keys = await getDashboardKeys(account.id);
  return <ApiKeysView initialKeys={keys} />;
}
