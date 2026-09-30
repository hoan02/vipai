import { getUsageLogsPage, parseLogFilters } from "@/server/logs";
import { UsageLogsView } from "@/components/dashboard/usage-logs-view";

export const dynamic = "force-dynamic";

export default async function UsageLogsPage() {
  const initial = await getUsageLogsPage(parseLogFilters(new URLSearchParams()));
  return <UsageLogsView initial={initial} />;
}
