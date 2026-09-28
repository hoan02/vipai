import { getModelPrices, requireRoot, type ModelPrice } from "@/server/admin";
import { listChannels } from "@/server/gateway";
import { PricingView } from "@/components/admin/pricing-view";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const { token } = await requireRoot();
  const [channels, prices] = await Promise.all([listChannels(token), getModelPrices(token)]);

  const models = [...new Set(channels.flatMap((channel) => channel.models))].sort();
  const rows: ModelPrice[] = models.map(
    (id) => prices.get(id) ?? { id, input: 0, output: 0, cache: null, perCall: null },
  );

  return <PricingView initialPrices={rows} />;
}
