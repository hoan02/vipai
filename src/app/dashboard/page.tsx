import { requireAccount } from "@/server/auth";
import { getDashboardOverview } from "@/server/dashboard";
import { OverviewView } from "@/components/dashboard/overview/overview-view";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const account = await requireAccount();
  const overview = await getDashboardOverview();
  return <OverviewView overview={overview} isAdmin={account.role >= 10} />;
}
