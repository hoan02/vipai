import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { setChannelStatus } from "@/server/gateway";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Enables (1) or disables (2) a channel. */
export async function POST(request: Request, { params }: Params) {
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

  let body: { enabled?: unknown };
  try {
    body = (await request.json()) as { enabled?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  try {
    await setChannelStatus(token, channelId, body.enabled ? 1 : 2);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "status_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
