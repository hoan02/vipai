import { requireAccount } from "@/server/auth";
import { getQuotaAnalytics } from "@/server/dashboard";
import { ModelsView } from "@/components/dashboard/models-view";

export const dynamic = "force-dynamic";

export default async function DashboardModelsPage() {
  const account = await requireAccount();
  // The admin role widens the window from the account's own usage to every
  // account's; the route enforces the same rule for later refetches.
  return <ModelsView initial={await getQuotaAnalytics(account.role >= 10)} />;
}
