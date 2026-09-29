import { getAuditLogsPage, parseLogFilters } from "@/server/logs";
import { AuditLogsView } from "@/components/dashboard/audit-logs-view";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const initial = await getAuditLogsPage(parseLogFilters(new URLSearchParams()));
  return <AuditLogsView initial={initial} />;
}
