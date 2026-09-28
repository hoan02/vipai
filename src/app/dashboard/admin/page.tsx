import { redirect } from "next/navigation";
import { getMarginConfigs, getModelPrices, requireRoot, type MarginConfig, type ModelPrice } from "@/server/admin";
import { listChannels } from "@/server/gateway";
import { AdminView } from "@/components/dashboard/admin-view";

export const dynamic = "force-dynamic";

/**
 * Admin: routing and pricing.
 *
 * The gateway splits its management API, so this page is gated on the root
 * account and sends anyone else back to the dashboard rather than rendering a
 * page whose writes would fail.
 */
export default async function DashboardAdminPage() {
  let access: Awaited<ReturnType<typeof requireRoot>> | null = null;
  try {
    access = await requireRoot();
  } catch {
    access = null;
  }
  if (!access) redirect("/dashboard");

  const [channels, prices, costs] = await Promise.all([
    listChannels(access.token),
    getModelPrices(access.token),
    getMarginConfigs(access.token),
  ]);

  const models = [...new Set(channels.flatMap((channel) => channel.models))].sort();
  const rows: ModelPrice[] = models.map(
    (id) => prices.get(id) ?? { id, input: 0, output: 0, cache: null, perCall: null },
  );
  const costRows: MarginConfig[] = models.map(
    (id) => costs.get(id) ?? { id, in: 0, out: 0, margin: 0 },
  );

  return (
    <AdminView initialChannels={channels} initialPrices={rows} initialCosts={costRows} />
  );
}
