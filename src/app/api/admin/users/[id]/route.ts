import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { manageUser } from "@/server/gateway";

export const dynamic = "force-dynamic";

const QUOTA_PER_USD = 500_000;

const ACTIONS = ["enable", "disable", "promote", "demote", "delete", "add_quota"] as const;
type Action = (typeof ACTIONS)[number];

type Params = { params: Promise<{ id: string }> };

/** Runs one account action. Body: `{ action, usd? }` (usd for add_quota). */
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
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 422 });
  }

  let body: { action?: unknown; usd?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; usd?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 422 });
  }

  let value = 0;
  if (action === "add_quota") {
    const usd = Number(body.usd);
    if (!Number.isFinite(usd) || usd === 0) {
      return NextResponse.json({ error: "invalid_amount", message: "Enter a non-zero USD amount." }, { status: 422 });
    }
    value = Math.round(usd * QUOTA_PER_USD);
  }

  try {
    await manageUser(token, userId, action, value);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "action_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
