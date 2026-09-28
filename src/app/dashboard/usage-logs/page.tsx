import { getLogStat, listLogsPaged, QUOTA_PER_USD } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { UsageLogsView } from "@/components/dashboard/usage-logs-view";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function UsageLogsPage() {
  const token = await requireAccessToken();
  const [logs, stat] = await Promise.all([
    listLogsPaged(token, { page: 0, pageSize: PAGE_SIZE }),
    getLogStat(token),
  ]);

  return (
    <UsageLogsView
      initial={{
        page: logs.page,
        pageSize: logs.pageSize,
        total: logs.total,
        stat: { quotaUsd: stat.quota / QUOTA_PER_USD, rpm: stat.rpm, tpm: stat.tpm },
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
      }}
    />
  );
}
