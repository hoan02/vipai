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
  /** Key into the `dash` namespace in `messages/`. A label is never written
   *  here, so the sidebar and the command palette cannot drift. */
  labelKey: string;
  href: string;
  icon: NavIcon;
  /** When true the item only matches its own path, never a child route. */
  exact?: boolean;
};

export type NavGroup = {
  id: string;
  /** Key for the section heading shown above the group's links. */
  titleKey: string;
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
    titleKey: "groupChat",
    items: [
      { labelKey: "itemPlayground", href: "/dashboard/playground", icon: "flask" },
      { labelKey: "itemChat", href: "/dashboard/chat", icon: "chat" },
    ],
  },
  {
    id: "general",
    titleKey: "groupGeneral",
    items: [
      { labelKey: "itemOverview", href: "/dashboard", icon: "gauge", exact: true },
      { labelKey: "itemModelAnalytics", href: "/dashboard/models", icon: "bars" },
      { labelKey: "itemApiKeys", href: "/dashboard/api-keys", icon: "key" },
      { labelKey: "itemUsageLogs", href: "/dashboard/usage-logs", icon: "scroll", exact: true },
      { labelKey: "itemAuditLogs", href: "/dashboard/usage-logs/audit", icon: "audit" },
      { labelKey: "itemTaskLogs", href: "/dashboard/usage-logs/task", icon: "tasks" },
    ],
  },
  {
    id: "personal",
    titleKey: "groupPersonal",
    items: [
      { labelKey: "itemWallet", href: "/dashboard/wallet", icon: "credit" },
      { labelKey: "itemProfile", href: "/dashboard/profile", icon: "user" },
      { labelKey: "itemSecurity", href: "/dashboard/security", icon: "shield" },
    ],
  },
];

export type ApiKeyStatus = "active" | "expired" | "disabled";

export type ApiKey = {
  id: string;
  name: string;
  masked: string;
  /** Machine-readable so the view, not the gateway mapping, chooses the words:
   *  a display string built here would be English-only in every locale. */
  status: ApiKeyStatus;
  /** ISO date the key was created; the view formats it per locale. */
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
