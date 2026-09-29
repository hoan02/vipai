import { NextResponse } from "next/server";
import { getDrawingLogsPage, getTaskLogsPage, parseLogFilters } from "@/server/logs";

export const dynamic = "force-dynamic";

/**
 * The account's async task log, one page at a time.
 *
 * `section=drawing` switches to the Midjourney-style drawing tasks; anything
 * else returns the general task log (video, music, and friends).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = parseLogFilters(params);
  const section = params.get("section") === "drawing" ? "drawing" : "task";
  try {
    const data =
      section === "drawing"
        ? await getDrawingLogsPage(filters)
        : await getTaskLogsPage(filters);
    return NextResponse.json({ section, ...data });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    return NextResponse.json(
      { error: "task_logs_failed", message: (error as Error).message },
      { status },
    );
  }
}
