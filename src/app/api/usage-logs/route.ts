import { NextResponse } from "next/server";
import { getUsageLogsPage, parseLogFilters } from "@/server/logs";

export const dynamic = "force-dynamic";

/**
 * The account's request log, one page at a time.
 *
 * Paged on the server rather than fetched whole: an active account can have
 * hundreds of thousands of rows, and the gateway caps a page at 100 anyway.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = parseLogFilters(params);
  try {
    return NextResponse.json(await getUsageLogsPage(filters));
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    return NextResponse.json(
      { error: "logs_failed", message: (error as Error).message },
      { status },
    );
  }
}
