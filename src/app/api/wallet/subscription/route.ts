import { NextResponse } from "next/server";
import {
  getSubscriptionPlans,
  getSubscriptionSelf,
  purchaseSubscriptionWithBalance,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/** The available plans and this account's subscriptions. */
export async function GET() {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [plans, self] = await Promise.all([
      getSubscriptionPlans(token),
      getSubscriptionSelf(token),
    ]);
    return NextResponse.json({ plans, self });
  } catch (error) {
    return NextResponse.json(
      { error: "subscription_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/** Buys a plan with the wallet balance. Body: `{ planId }`. */
export async function POST(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { planId?: unknown };
  try {
    body = (await request.json()) as { planId?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planId = Number(body.planId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json(
      { error: "invalid_plan", message: "Choose a plan." },
      { status: 422 },
    );
  }

  try {
    await purchaseSubscriptionWithBalance(token, planId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "purchase_failed", message: (error as Error).message },
      { status: 400 },
    );
  }
}
