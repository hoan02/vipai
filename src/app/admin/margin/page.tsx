import {
  getMarginConfigs,
  getModelPrices,
  requireRoot,
  type MarginConfig,
  type ModelPrice,
} from "@/server/admin";
import { listChannels } from "@/server/gateway";
import { MarginView } from "@/components/admin/margin-view";

export const dynamic = "force-dynamic";

export default async function AdminMarginPage() {
  const { token } = await requireRoot();
  const [channels, prices, costs] = await Promise.all([
    listChannels(token),
    getModelPrices(token),
    getMarginConfigs(token),
  ]);

  const models = [...new Set(channels.flatMap((channel) => channel.models))].sort();
  const priceRows: ModelPrice[] = models.map(
    (id) => prices.get(id) ?? { id, input: 0, output: 0, cache: null, perCall: null },
  );
  const costRows: MarginConfig[] = models.map(
    (id) => costs.get(id) ?? { id, in: 0, out: 0, margin: 0 },
  );

  return <MarginView initialPrices={priceRows} initialCosts={costRows} />;
}
