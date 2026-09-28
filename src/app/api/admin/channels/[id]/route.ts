import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { updateChannel } from "@/server/gateway";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Edits a channel's routing fields: models, group, priority and weight. */
export async function PATCH(request: Request, { params }: Params) {
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: { models?: string; group?: string; priority?: number; weight?: number } = {};
  if (typeof body.models === "string") patch.models = body.models;
  if (typeof body.group === "string") patch.group = body.group;
  if (typeof body.priority === "number") patch.priority = body.priority;
  if (typeof body.weight === "number") patch.weight = body.weight;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 422 });
  }

  try {
    await updateChannel(token, channelId, patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "update_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
