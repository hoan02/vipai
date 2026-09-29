import { NextResponse } from "next/server";
import { getAffiliateCode, transferAffiliateQuota } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/** The account's affiliate code and referral earnings. */
export async function GET() {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const code = await getAffiliateCode(token).catch(() => "");
    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json(
      { error: "affiliate_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/** Moves affiliate earnings into the wallet balance. Body: `{ quota }`. */
export async function POST(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { quota?: unknown };
  try {
    body = (await request.json()) as { quota?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const quota = Number(body.quota);
  if (!Number.isFinite(quota) || quota <= 0) {
    return NextResponse.json(
      { error: "invalid_quota", message: "Enter an amount to transfer." },
      { status: 422 },
    );
  }

  try {
    await transferAffiliateQuota(token, Math.floor(quota));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "transfer_failed", message: (error as Error).message },
      { status: 400 },
    );
  }
}
