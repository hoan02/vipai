import { NextResponse } from "next/server";
import { requireAccessToken } from "@/server/repositories";
import { getLogStat, listLogsPaged, QUOTA_PER_USD } from "@/server/gateway";

export const dynamic = "force-dynamic";

/**
 * The account's usage log, one page at a time.
 *
 * Paged on the server rather than fetched whole: an active account can have
 * hundreds of thousands of rows, and the gateway caps a page at 100 anyway.
 */
export async function GET(request: Request) {
  let token: string;
  try {
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const page = Number.parseInt(params.get("page") ?? "0", 10) || 0;
  const pageSize = Number.parseInt(params.get("pageSize") ?? "20", 10) || 20;

  try {
    const [logs, stat] = await Promise.all([
      listLogsPaged(token, { page, pageSize }),
      getLogStat(token),
    ]);

    return NextResponse.json({
      page: logs.page,
      pageSize: logs.pageSize,
      total: logs.total,
      stat: {
        quotaUsd: stat.quota / QUOTA_PER_USD,
        rpm: stat.rpm,
        tpm: stat.tpm,
      },
      items: logs.items.map((row) => ({
        id: String(row.id),
        createdAt: new Date((row.created_at ?? 0) * 1000).toISOString(),
        model: row.model_name || "unknown",
        source: row.token_name || "default",
        promptTokens: row.prompt_tokens ?? 0,
        completionTokens: row.completion_tokens ?? 0,
        costUsd: (row.quota ?? 0) / QUOTA_PER_USD,
        stream: Boolean(row.is_stream),
        seconds: row.use_time ?? 0,
        group: row.group || "default",
        ip: row.ip || "",
        requestId: row.request_id || "",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "logs_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
