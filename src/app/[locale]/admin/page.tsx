import { getAdminStats, requireRoot } from "@/server/admin";
import { listChannels } from "@/server/gateway";
import { OverviewView } from "@/components/admin/overview-view";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { token } = await requireRoot();
  const [channels, stats] = await Promise.all([listChannels(token), getAdminStats(token)]);

  const models = new Set(channels.flatMap((channel) => channel.models)).size;

  return <OverviewView stats={stats} channels={channels.length} models={models} />;
}
