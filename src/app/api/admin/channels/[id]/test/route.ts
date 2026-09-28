import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { GatewayError, testChannel } from "@/server/gateway";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Runs the gateway's own upstream test against a channel. */
export async function POST(_request: Request, { params }: Params) {
  let token = "";
  try {
    ({ token } = await requireRoot());
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { error: "forbidden", message },
      { status: message === "Not signed in" ? 401 : 403 },
    );
  }

  const { id } = await params;
  const channelId = Number(id);
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 422 });
  }

  try {
    const result = await testChannel(token, channelId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof GatewayError ? error.message : (error as Error).message;
    return NextResponse.json({ error: "test_failed", message }, { status: 502 });
  }
}
