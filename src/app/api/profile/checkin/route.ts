import { NextResponse } from "next/server";
import { doCheckin, getCheckinStatus, QUOTA_PER_USD } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/** The check-in calendar, totals and today's state for the account. */
export async function GET(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  try {
    const status = await getCheckinStatus(token, month);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    return NextResponse.json(
      { error: "checkin_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/** Claims today's check-in. */
export async function POST() {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const quota = await doCheckin(token);
    return NextResponse.json({ ok: true, awardedUsd: quota / QUOTA_PER_USD });
  } catch (error) {
    return NextResponse.json(
      { error: "checkin_failed", message: (error as Error).message },
      { status: 400 },
    );
  }
}
