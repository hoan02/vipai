// Shapes for the dashboard views, plus the static navigation.
//
// Data is never defined here. Every figure comes from the new-api gateway
// through `@/server/*`; when the account has no data yet, the views render
// their empty state instead of sample numbers.

export type NavItem = {
  label: string;
  href: string;
  icon: "credit" | "key" | "pulse" | "scroll" | "bars" | "gauge" | "shield" | "user" | "chat";
};

export const dashboardNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "gauge" },
  { label: "Playground", href: "/dashboard/playground", icon: "chat" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "credit" },
  { label: "API Keys", href: "/dashboard/api-keys", icon: "key" },
  { label: "Usage", href: "/dashboard/usage", icon: "pulse" },
  { label: "Usage logs", href: "/dashboard/usage-logs", icon: "scroll" },
  { label: "Profile", href: "/dashboard/profile", icon: "user" },
  { label: "Security", href: "/dashboard/security", icon: "shield" },
];

export type ApiKey = {
  id: string;
  name: string;
  masked: string;
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
