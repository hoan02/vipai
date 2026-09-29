import { NextResponse } from "next/server";
import { getAuditLogsPage, parseLogFilters } from "@/server/logs";

export const dynamic = "force-dynamic";

/** The account's audit-log rows: authenticated actions taken with this account or its keys. */
export async function GET(request: Request) {
  const filters = parseLogFilters(new URL(request.url).searchParams);
  try {
    return NextResponse.json(await getAuditLogsPage(filters));
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    return NextResponse.json(
      { error: "audit_failed", message: (error as Error).message },
      { status },
    );
  }
}
