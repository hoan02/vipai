// Sample account data for the authenticated dashboard prototype.
// Shapes mirror the real product surfaces; values are clearly demo content.

export const account = {
  email: "hoanvipboi1@gmail.com",
  display: "hoanvipboi1@g…",
  initial: "H",
};

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
  id?: string;
  name: string;
  masked: string;
  status: "Active" | "Revoked";
  created: string;
  requests: string;
};

export const apiKeys: ApiKey[] = [
  { name: "Production", masked: "sk-aigiare-live-4f7c••••••••a91d", status: "Active", created: "Sep 12, 2026", requests: "128,402" },
  { name: "Local dev", masked: "sk-aigiare-test-b0e2••••••••7c14", status: "Active", created: "Sep 18, 2026", requests: "3,918" },
  { name: "Staging", masked: "sk-aigiare-test-19aa••••••••e05f", status: "Revoked", created: "Aug 30, 2026", requests: "22,760" },
];

export type Purchase = {
  date: string;
  source: string;
  status: string;
  amount: string;
  invoice: string;
};

export const purchases: Purchase[] = [
  { date: "Sep 04, 2026", source: "Stripe", status: "Paid", amount: "$50.00", invoice: "INV-2041" },
  { date: "Aug 06, 2026", source: "Stripe", status: "Paid", amount: "$20.00", invoice: "INV-1988" },
];

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

export const billingRows: BillingRow[] = [
  { time: "Sep 25, 14:02", model: "GPT-5.6 Sol", source: "Codex Desktop", input: "182,400", output: "31,050", cacheRead: "96,200", cacheWrite: "12,400", amount: "$0.14", balance: "−$0.14" },
  { time: "Sep 25, 13:41", model: "Claude Sonnet 5", source: "Claude CLI", input: "74,910", output: "18,632", cacheRead: "40,110", cacheWrite: "3,900", amount: "$0.09", balance: "−$0.09" },
  { time: "Sep 25, 12:18", model: "GPT-5.6 Luna", source: "VSCode", input: "220,140", output: "44,700", cacheRead: "150,880", cacheWrite: "8,020", amount: "$0.06", balance: "−$0.06" },
  { time: "Sep 25, 11:07", model: "Gemini 3.1 Pro", source: "OpenClaw", input: "51,300", output: "9,140", cacheRead: "22,000", cacheWrite: "2,100", amount: "$0.03", balance: "−$0.03" },
];

export const balance = "$31.68";
export const monthSpend = "$18.32";
export const savedThisMonth = "$94.10";

export const usageSummary = {
  input: "528,750",
  output: "103,522",
  cacheRead: "309,190",
  cacheWrite: "26,420",
};

// 14-day series for the usage chart (tokens per day, thousands).
export const usageSeries: Array<{ day: string; input: number; output: number }> = [
  { day: "12", input: 18, output: 4 },
  { day: "13", input: 26, output: 6 },
  { day: "14", input: 22, output: 5 },
  { day: "15", input: 34, output: 8 },
  { day: "16", input: 41, output: 9 },
  { day: "17", input: 30, output: 7 },
  { day: "18", input: 38, output: 8 },
  { day: "19", input: 52, output: 12 },
  { day: "20", input: 47, output: 10 },
  { day: "21", input: 44, output: 9 },
  { day: "22", input: 58, output: 13 },
  { day: "23", input: 49, output: 11 },
  { day: "24", input: 63, output: 14 },
  { day: "25", input: 37, output: 8 },
];

export type Member = {
  email: string;
  role: "Admin" | "Developer" | "Viewer";
  used: string;
  cap: string;
  pct: number;
};

export const members: Member[] = [
  { email: "hoanvipboi1@gmail.com", role: "Admin", used: "$18.32", cap: "Not set", pct: 0 },
  { email: "linh.tran@aigiare.site", role: "Developer", used: "$6.10", cap: "$40.00", pct: 15 },
  { email: "kai.dev@aigiare.site", role: "Viewer", used: "$0.00", cap: "$10.00", pct: 0 },
];

export const orgBudget = { total: "$200.00", used: "$24.42", pct: 12 };

export const costByModel: Array<{ model: string; vendor: string; requests: string; tokens: string; spend: string; saved: string }> = [
  { model: "GPT-5.6 Sol", vendor: "OpenAI", requests: "128,402", tokens: "1.42B", spend: "$8.94", saved: "$44.20" },
  { model: "Claude Sonnet 5", vendor: "Anthropic", requests: "86,110", tokens: "0.91B", spend: "$5.36", saved: "$31.10" },
  { model: "GPT-5.6 Luna", vendor: "OpenAI", requests: "61,240", tokens: "0.64B", spend: "$2.18", saved: "$12.70" },
  { model: "Gemini 3.1 Pro", vendor: "Google", requests: "22,760", tokens: "0.22B", spend: "$1.84", saved: "$6.10" },
];
