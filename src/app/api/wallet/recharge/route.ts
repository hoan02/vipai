import { NextResponse } from "next/server";
import { requestEpayTopUp } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/** Starts an online top-up. Body: `{ amount, paymentMethod }`. Returns `{ url }`. */
export async function POST(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { amount?: unknown; paymentMethod?: unknown };
  try {
    body = (await request.json()) as { amount?: unknown; paymentMethod?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "invalid_amount", message: "Enter a top-up amount." },
      { status: 422 },
    );
  }
  if (!paymentMethod) {
    return NextResponse.json(
      { error: "invalid_method", message: "Choose a payment method." },
      { status: 422 },
    );
  }

  try {
    const { url, params } = await requestEpayTopUp(token, Math.floor(amount), paymentMethod);
    return NextResponse.json({ ok: true, url, params });
  } catch (error) {
    return NextResponse.json(
      { error: "recharge_failed", message: (error as Error).message },
      { status: 400 },
    );
  }
}
