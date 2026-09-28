import { requireRoot } from "@/server/admin";
import { listChannels } from "@/server/gateway";
import { ChannelsView } from "@/components/admin/channels-view";

export const dynamic = "force-dynamic";

export default async function AdminChannelsPage() {
  const { token } = await requireRoot();
  return <ChannelsView initialChannels={await listChannels(token)} />;
}
