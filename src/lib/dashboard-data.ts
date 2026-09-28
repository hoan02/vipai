// Shapes for the dashboard views, plus the static navigation.
//
// Data is never defined here. Every figure comes from the Go backend through
// `@/server/*`; when the account has no data yet, the views render their empty
// state instead of sample numbers.

export type NavItem = {
  label: string;
  href: string;
  icon: "wallet" | "sliders" | "key" | "pulse" | "bars" | "users" | "gauge";
};

export const dashboardNav: NavItem[] = [
  { label: "Billing", href: "/dashboard", icon: "wallet" },
  { label: "Routing", href: "/dashboard/routing", icon: "sliders" },
  { label: "API Keys", href: "/dashboard/api-keys", icon: "key" },
  { label: "Usage", href: "/dashboard/usage", icon: "pulse" },
  { label: "Cost", href: "/dashboard/cost", icon: "bars" },
  { label: "Members", href: "/dashboard/members", icon: "users" },
  { label: "Budgets", href: "/dashboard/budgets", icon: "gauge" },
];

export type ApiKey = {
  id: string;
  name: string;
  masked: string;
  status: "Active" | "Revoked";
  created: string;
  /** Total requests made with this key, when the backend reports it. */
  requests: string | null;
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

/** Zeroed summary shown when the backend has no usage recorded yet. */
export const usageSummary: UsageSummary = {
  input: "0",
  output: "0",
  cacheRead: "0",
  cacheWrite: "0",
};

export type UsagePoint = {
  /** Day of month, as rendered on the chart's x axis. */
  day: string;
  /** Thousands of tokens. */
  input: number;
  output: number;
};

/** Empty series; the usage view renders an empty state. */
export const usageSeries: UsagePoint[] = [];

export const monthSpend = "$0.00";
export const savedThisMonth = "$0.00";

/** Credit balance. Not tracked by the backend yet. */
export const balance: string | null = null;

export type Member = {
  email: string;
  role: "Admin" | "Developer" | "Viewer";
  used: string;
  cap: string;
  pct: number;
};

/** No members until an organization or team backend exists. */
export const members: Member[] = [];

export const orgBudget: { total: string; used: string; pct: number } | null = null;

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
