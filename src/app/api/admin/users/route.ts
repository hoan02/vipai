import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { listAdminUsers } from "@/server/gateway";

export const dynamic = "force-dynamic";

const QUOTA_PER_USD = 500_000;

/** Lists accounts, optionally filtered by `?keyword=`. */
export async function GET(request: Request) {
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

  const keyword = new URL(request.url).searchParams.get("keyword")?.trim() ?? "";

  try {
    const { items, total } = await listAdminUsers(token, keyword);
    return NextResponse.json({
      total,
      items: items.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        status: user.status,
        balanceUsd: user.quota / QUOTA_PER_USD,
        usedUsd: user.usedQuota / QUOTA_PER_USD,
        requestCount: user.requestCount,
        group: user.group,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "list_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
