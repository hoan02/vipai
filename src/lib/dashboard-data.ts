// Shapes for the dashboard views, plus the static navigation.
//
// Data is never defined here. Every figure comes from the new-api gateway
// through `@/server/*`; when the account has no data yet, the views render
// their empty state instead of sample numbers.

export type NavItem = {
  label: string;
  href: string;
  icon: "wallet" | "credit" | "sliders" | "key" | "pulse" | "bars" | "users" | "gauge" | "shield" | "user" | "chat";
};

export const dashboardNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "gauge" },
  { label: "Playground", href: "/dashboard/playground", icon: "chat" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "credit" },
  { label: "API Keys", href: "/dashboard/api-keys", icon: "key" },
  { label: "Usage", href: "/dashboard/usage", icon: "pulse" },
  { label: "Usage logs", href: "/dashboard/usage-logs", icon: "pulse" },
  { label: "Billing", href: "/dashboard/cost", icon: "bars" },
  { label: "Profile", href: "/dashboard/profile", icon: "user" },
  { label: "Security", href: "/dashboard/security", icon: "shield" },
];

export type ApiKey = {
  id: string;
  name: string;
  masked: string;
  /** Kept for compatibility; `statusText` carries the full wording. */
  status: "Active" | "Revoked";
  /** Ready to display: "Active", "Expired", "Quota used". */
  statusText: string;
  created: string;
  /** Total requests made with this key, when the backend reports it. */
  requests: string | null;
  /** Spend charged to this key, in US dollars. */
  usedUsd: number;
  /** Billing group; empty means the account default. */
  group: string;
  /** Model allow-list. Empty means the key may use any model. */
  models: string[];
  /** Source addresses the key accepts. Empty means any. */
  allowIps: string;
  /** ISO date the key expires, or null when it never does. */
  expiresAt: string | null;
};

export type Purchase = {
  date: string;
  source: string;
  status: string;
  amount: string;
  invoice: string;
};

/** No purchase history is available until a billing provider is integrated. */
export const purchases: Purchase[] = [];

export type BillingRow = {
  time: string;
  model: string;
  source: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
  amount: string;
  balance: string;
};

export type UsageSummary = {
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
};

export type UsagePoint = {
  /** Day of month, as rendered on the chart's x axis. */
  day: string;
  /** Thousands of tokens. */
  input: number;
  output: number;
};

export const monthSpend = "$0.00";
export const savedThisMonth = "$0.00";

export type Member = {
  email: string;
  role: "Admin" | "Developer" | "Viewer";
  used: string;
  cap: string;
  pct: number;
};

/** No members until an organization or team backend exists. */
export const members: Member[] = [];

export type CostByModel = {
  model: string;
  vendor: string;
  requests: string;
  tokens: string;
  spend: string;
  saved: string;
};

/** No cost breakdown until per-model reporting is implemented. */
export const costByModel: CostByModel[] = [];
