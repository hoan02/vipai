import { NextResponse } from "next/server";
import {
  getLogStat,
  getTopUpInfo,
  getUser,
  listTopUps,
  QUOTA_PER_USD,
  redeemCode,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/**
 * The account's wallet: balance, purchases, and what the gateway accepts.
 *
 * Split from the dashboard's billing view on purpose. That summarises recent
 * usage; this is the money side — what was bought, and what can be bought.
 */
export async function GET() {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [user, topups, info, stat] = await Promise.all([
      getUser(token),
      listTopUps(token),
      getTopUpInfo(token),
      getLogStat(token),
    ]);

    return NextResponse.json({
      balanceUsd: user.quota / QUOTA_PER_USD,
      usedUsd: user.usedQuota / QUOTA_PER_USD,
      requestCount: user.requestCount,
      /** Spent quota is authoritative; the stat is a live rate snapshot. */
      recentQuotaUsd: stat.quota / QUOTA_PER_USD,
      group: user.group,
      topups: topups.map((row) => ({
        id: row.id,
        amountUsd: (row.amount ?? 0) / QUOTA_PER_USD,
        paidUsd: row.money ?? 0,
        tradeNo: row.trade_no || "",
        status: row.status || "",
        paymentMethod: row.payment_method || "",
        createdAt: new Date((row.create_time ?? 0) * 1000).toISOString(),
        completedAt: row.complete_time
          ? new Date(row.complete_time * 1000).toISOString()
          : null,
      })),
      info,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "wallet_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/** Redeems a credit code. Body: `{ key }`. */
export async function POST(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { key?: unknown };
  try {
    body = (await request.json()) as { key?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return NextResponse.json(
      { error: "invalid_key", message: "Enter a credit code." },
      { status: 422 },
    );
  }

  try {
    const quota = await redeemCode(token, key);
    return NextResponse.json({ ok: true, creditedUsd: quota / QUOTA_PER_USD });
  } catch (error) {
    // The gateway answers the same message for every bad code, so it is passed
    // through rather than guessed at.
    return NextResponse.json(
      { error: "redeem_failed", message: (error as Error).message },
      { status: 400 },
    );
  }
}
