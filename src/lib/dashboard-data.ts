// Shapes for the dashboard views, plus the static navigation.
//
// Data is never defined here. Every figure comes from the new-api gateway
// through `@/server/*`; when the account has no data yet, the views render
// their empty state instead of sample numbers.

export type NavIcon =
  | "gauge"
  | "flask"
  | "chat"
  | "bars"
  | "key"
  | "scroll"
  | "audit"
  | "tasks"
  | "credit"
  | "user"
  | "shield";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** When true the item only matches its own path, never a child route. */
  exact?: boolean;
};

export type NavGroup = {
  id: string;
  /** Section heading shown above the group's links. */
  title: string;
  items: NavItem[];
};

/**
 * The signed-in navigation, grouped the way new-api's sidebar is: a chat
 * workspace, the gateway tools, and the personal account section.
 *
 * Harmless duplication is avoided here: the old Billing and Usage pages were
 * folded into Wallet and Model analytics, so one concept has one home.
 */
export const dashboardNavGroups: NavGroup[] = [
  {
    id: "chat",
    title: "Chat",
    items: [
      { label: "Playground", href: "/dashboard/playground", icon: "flask" },
      { label: "Chat", href: "/dashboard/chat", icon: "chat" },
    ],
  },
  {
    id: "general",
    title: "General",
    items: [
      { label: "Overview", href: "/dashboard", icon: "gauge", exact: true },
      { label: "Model analytics", href: "/dashboard/models", icon: "bars" },
      { label: "API keys", href: "/dashboard/api-keys", icon: "key" },
      { label: "Usage logs", href: "/dashboard/usage-logs", icon: "scroll", exact: true },
      { label: "Audit logs", href: "/dashboard/usage-logs/audit", icon: "audit" },
      { label: "Task logs", href: "/dashboard/usage-logs/task", icon: "tasks" },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    items: [
      { label: "Wallet", href: "/dashboard/wallet", icon: "credit" },
      { label: "Profile", href: "/dashboard/profile", icon: "user" },
      { label: "Security", href: "/dashboard/security", icon: "shield" },
    ],
  },
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
