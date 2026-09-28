import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { createRedemptions, listRedemptions } from "@/server/gateway";

export const dynamic = "force-dynamic";

/** Quota units per US dollar, matching new-api. */
const QUOTA_PER_USD = 500_000;

function forbidden(error: unknown) {
  const message = (error as Error).message;
  return NextResponse.json(
    { error: "forbidden", message },
    { status: message === "Not signed in" ? 401 : 403 },
  );
}

export async function GET() {
  let token = "";
  try {
    ({ token } = await requireRoot());
  } catch (error) {
    return forbidden(error);
  }
  try {
    const { items, total } = await listRedemptions(token);
    return NextResponse.json({
      total,
      items: items.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.key,
        status: row.status,
        usd: row.quota / QUOTA_PER_USD,
        createdTime: row.created_time,
        expiredTime: row.expired_time,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "list_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/** Creates codes. Body: `{ name, usd, count, expiredTime }`. */
export async function POST(request: Request) {
  let token = "";
  try {
    ({ token } = await requireRoot());
  } catch (error) {
    return forbidden(error);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const usd = Number(body.usd);
  const count = Number(body.count);
  const expiredTime = body.expiredTime === undefined ? 0 : Number(body.expiredTime);

  if (!name || name.length > 20) {
    return NextResponse.json({ error: "invalid_name", message: "Name is required (max 20 characters)." }, { status: 422 });
  }
  if (!(usd > 0)) {
    return NextResponse.json({ error: "invalid_value", message: "Enter a credit value in USD." }, { status: 422 });
  }
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return NextResponse.json({ error: "invalid_count", message: "Count must be between 1 and 100." }, { status: 422 });
  }

  try {
    const keys = await createRedemptions(token, {
      name,
      quota: Math.round(usd * QUOTA_PER_USD),
      count,
      expiredTime: Number.isFinite(expiredTime) ? expiredTime : 0,
    });
    return NextResponse.json({ ok: true, keys }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "create_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
