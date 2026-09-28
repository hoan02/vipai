import { NextResponse } from "next/server";
import { getModelPrices, requireRoot } from "@/server/admin";
import { listChannels } from "@/server/gateway";

export const dynamic = "force-dynamic";

/** Channels and the prices of the models they serve, for the admin page. */
export async function GET() {
  try {
    const { token } = await requireRoot();
    const [channels, prices] = await Promise.all([listChannels(token), getModelPrices(token)]);

    const models = [...new Set(channels.flatMap((channel) => channel.models))].sort();
    const rows = models.map(
      (id) => prices.get(id) ?? { id, input: 0, output: 0, cache: null },
    );

    return NextResponse.json({ channels, prices: rows });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { error: "forbidden", message },
      { status: message === "Not signed in" ? 401 : 403 },
    );
  }
}
