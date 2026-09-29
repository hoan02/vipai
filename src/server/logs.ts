import "server-only";

import {
  QUOTA_PER_USD,
  getLogStat,
  listAuditLogsPaged,
  listDrawingLogsPaged,
  listLogsPaged,
  listTaskLogsPaged,
  type LogQuery,
} from "./gateway";
import { requireAccessToken } from "./repositories";

/**
 * View shapes for the Usage logs workspace.
 *
 * The three sections (common, audit, task) share one filter contract, so the
 * parsing lives here and both the server components and this app's own route
 * handlers call the same functions.
 */

export type LogFilters = {
  page: number;
  pageSize: number;
  from: number | null;
  to: number | null;
  model: string;
  group: string;
  source: string;
};

export function parseLogFilters(params: URLSearchParams, defaultPageSize = 20): LogFilters {
  const num = (value: string | null) => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  return {
    page: Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0),
    pageSize: Math.min(
      100,
      Math.max(1, Number.parseInt(params.get("pageSize") ?? String(defaultPageSize), 10) || defaultPageSize),
    ),
    from: num(params.get("from")),
    to: num(params.get("to")),
    model: (params.get("model") ?? "").trim(),
    group: (params.get("group") ?? "").trim(),
    source: (params.get("source") ?? "").trim(),
  };
}

function toQuery(filters: LogFilters): LogQuery {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    startTimestamp: filters.from ?? undefined,
    endTimestamp: filters.to ?? undefined,
    modelName: filters.model || undefined,
    group: filters.group || undefined,
    tokenName: filters.source || undefined,
  };
}

export type UsageLogRow = {
  id: string;
  createdAt: string;
  model: string;
  source: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  stream: boolean;
  seconds: number;
  group: string;
  ip: string;
  requestId: string;
};

export type UsageLogStat = { quotaUsd: number; rpm: number; tpm: number };

export type UsageLogPage = {
  page: number;
  pageSize: number;
  total: number;
  stat: UsageLogStat;
  items: UsageLogRow[];
};

export async function getUsageLogsPage(filters: LogFilters): Promise<UsageLogPage> {
  const token = await requireAccessToken();
  const [logs, stat] = await Promise.all([
    listLogsPaged(token, toQuery(filters)),
    getLogStat(token).catch(() => ({ quota: 0, rpm: 0, tpm: 0 })),
  ]);

  return {
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
  };
}

export type AuditLogRow = {
  id: string;
  createdAt: string;
  category: string;
  action: string;
  method: string;
  route: string;
  status: number;
  success: boolean;
  ip: string;
  tokenRef: string;
  requestId: string;
  content: string;
};

export type AuditLogPage = {
  page: number;
  pageSize: number;
  total: number;
  items: AuditLogRow[];
};

export async function getAuditLogsPage(filters: LogFilters): Promise<AuditLogPage> {
  const token = await requireAccessToken();
  const logs = await listAuditLogsPaged(token, toQuery(filters));
  return {
    page: logs.page,
    pageSize: logs.pageSize,
    total: logs.total,
    items: logs.items.map((row) => ({
      id: String(row.id),
      createdAt: new Date((row.created_at ?? 0) * 1000).toISOString(),
      category: row.category || "",
      action: row.action || "",
      method: row.method || "",
      route: row.route || "",
      status: row.status ?? 0,
      success: Boolean(row.success),
      ip: row.ip || "",
      tokenRef: row.token_ref || "",
      requestId: row.request_id || "",
      content: row.content || "",
    })),
  };
}

export type TaskLogRow = {
  id: string;
  createdAt: string;
  taskId: string;
  platform: string;
  action: string;
  status: string;
  progress: string;
  quotaUsd: number;
  failReason: string;
};

export type TaskLogPage = {
  page: number;
  pageSize: number;
  total: number;
  items: TaskLogRow[];
};

function taskTime(row: { submit_time: number; created_at?: number }): string {
  const seconds = row.submit_time || row.created_at || 0;
  return new Date(seconds * 1000).toISOString();
}

export async function getTaskLogsPage(filters: LogFilters): Promise<TaskLogPage> {
  const token = await requireAccessToken();
  const logs = await listTaskLogsPaged(token, toQuery(filters));
  return {
    page: logs.page,
    pageSize: logs.pageSize,
    total: logs.total,
    items: logs.items.map((row) => ({
      id: String(row.id),
      createdAt: taskTime(row),
      taskId: row.task_id || "",
      platform: row.platform || "",
      action: row.action || "",
      status: row.status || "",
      progress: row.progress || "",
      quotaUsd: (row.quota ?? 0) / QUOTA_PER_USD,
      failReason: row.fail_reason || "",
    })),
  };
}

export type DrawingLogRow = {
  id: string;
  createdAt: string;
  action: string;
  prompt: string;
  status: string;
  progress: string;
  quotaUsd: number;
  imageUrl: string;
  failReason: string;
};

export type DrawingLogPage = {
  page: number;
  pageSize: number;
  total: number;
  items: DrawingLogRow[];
};

export async function getDrawingLogsPage(filters: LogFilters): Promise<DrawingLogPage> {
  const token = await requireAccessToken();
  const logs = await listDrawingLogsPaged(token, toQuery(filters));
  return {
    page: logs.page,
    pageSize: logs.pageSize,
    total: logs.total,
    items: logs.items.map((row) => ({
      id: String(row.id),
      createdAt: taskTime(row),
      action: row.action || "",
      prompt: row.prompt || row.prompt_en || "",
      status: row.status || "",
      progress: row.progress || "",
      quotaUsd: (row.quota ?? 0) / QUOTA_PER_USD,
      imageUrl: row.image_url || "",
      failReason: row.fail_reason || "",
    })),
  };
}
