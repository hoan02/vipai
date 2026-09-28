import { getAdminStats, requireRoot } from "@/server/admin";
import { StatsView } from "@/components/admin/stats-view";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const { token } = await requireRoot();
  return <StatsView stats={await getAdminStats(token)} />;
}
