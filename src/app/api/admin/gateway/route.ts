import { NextResponse } from "next/server";
import { getMarginConfigs, getModelPrices, requireRoot } from "@/server/admin";
import { listChannels } from "@/server/gateway";

export const dynamic = "force-dynamic";

/** Channels and the prices of the models they serve, for the admin page. */
export async function GET() {
  try {
    const { token } = await requireRoot();
    const [channels, prices, costs] = await Promise.all([
      listChannels(token),
      getModelPrices(token),
      getMarginConfigs(token),
    ]);

    const models = [...new Set(channels.flatMap((channel) => channel.models))].sort();
    const rows = models.map(
      (id) => prices.get(id) ?? { id, input: 0, output: 0, cache: null, perCall: null },
    );
    const costRows = models.map((id) => costs.get(id) ?? { id, in: 0, out: 0, margin: 0 });

    return NextResponse.json({ channels, prices: rows, costs: costRows });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { error: "forbidden", message },
      { status: message === "Not signed in" ? 401 : 403 },
    );
  }
}
