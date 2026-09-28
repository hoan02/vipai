import { NextResponse } from "next/server";
import { requireAccessToken } from "@/server/repositories";
import { getQuotaData, getUser } from "@/server/gateway";

export const dynamic = "force-dynamic";

/** new-api's role for an administrator; the admin data route needs it. */
const ADMIN_ROLE = 10;
const MAX_WINDOW_SECONDS = 366 * 24 * 60 * 60;
const GRANULARITIES = new Set(["hour", "day", "week"]);

/**
 * The model-analytics window, from the gateway's quota rollup.
 *
 * Everything the charts need arrives in one request: the gateway groups its
 * logs into `{created_at, model_name, count, token_used, quota}` buckets, and
 * the client turns those into series. The window is validated and capped so a
 * hand-written query cannot ask for years of data.
 */
export async function GET(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const from = Number.parseInt(params.get("from") ?? "", 10);
  const to = Number.parseInt(params.get("to") ?? "", 10);
  const granularity = params.get("granularity") ?? "hour";
  const username = params.get("username")?.trim() || undefined;

  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return NextResponse.json({ error: "bad_range" }, { status: 400 });
  }
  if (!GRANULARITIES.has(granularity)) {
    return NextResponse.json({ error: "bad_granularity" }, { status: 400 });
  }
  if (to - from > MAX_WINDOW_SECONDS) {
    return NextResponse.json({ error: "range_too_wide" }, { status: 400 });
  }

  try {
    const user = await getUser(token);
    const items = await getQuotaData(
      token,
      { startTimestamp: from, endTimestamp: to, granularity, username },
      user.role >= ADMIN_ROLE,
    );
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: "analytics_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
