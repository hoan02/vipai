import { getTaskLogsPage, parseLogFilters } from "@/server/logs";
import { TaskLogsView } from "@/components/dashboard/task-logs-view";

export const dynamic = "force-dynamic";

export default async function TaskLogsPage() {
  const initial = await getTaskLogsPage(parseLogFilters(new URLSearchParams()));
  return <TaskLogsView initial={{ ...initial, section: "task" }} />;
}
