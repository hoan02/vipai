import { requireAccount } from "@/server/auth";
import { getDashboardUsage } from "@/server/dashboard";
import { UsageView } from "@/components/dashboard/usage-view";

export const dynamic = "force-dynamic";

export default async function DashboardUsagePage() {
  const account = await requireAccount();
  const usage = await getDashboardUsage(account.id);
  return <UsageView usage={usage} />;
}
