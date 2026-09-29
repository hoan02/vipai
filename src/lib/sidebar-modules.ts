// Sidebar visibility preferences.
//
// The signed-in user may hide whole sections or single modules, mirroring
// new-api's `sidebar_modules` setting. The stored value is a JSON object of
// section keys, each with an `enabled` flag plus one boolean per module, for
// example: { chat: { enabled: true, playground: true, chat: false } }.
//
// A missing field means visible: the setting only ever narrows the default
// navigation, so an account that never touched it keeps every entry.

export type SidebarModule = {
  key: string;
  label: string;
  description: string;
  /** The nav href this module controls. */
  href: string;
};

export type SidebarSection = {
  key: string;
  label: string;
  description: string;
  modules: SidebarModule[];
};

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    key: "chat",
    label: "Chat",
    description: "Playground and chat.",
    modules: [
      {
        key: "playground",
        label: "Playground",
        description: "Try a model in a scratch thread.",
        href: "/dashboard/playground",
      },
      {
        key: "chat",
        label: "Chat",
        description: "Saved conversations.",
        href: "/dashboard/chat",
      },
    ],
  },
  {
    key: "console",
    label: "Console",
    description: "Analytics, keys and logs.",
    modules: [
      {
        key: "detail",
        label: "Overview",
        description: "Home and service health.",
        href: "/dashboard",
      },
      {
        key: "model",
        label: "Model analytics",
        description: "Spend and call volume per model.",
        href: "/dashboard/models",
      },
      {
        key: "token",
        label: "API keys",
        description: "Credentials for the API.",
        href: "/dashboard/api-keys",
      },
      {
        key: "log",
        label: "Usage logs",
        description: "Every request the account made.",
        href: "/dashboard/usage-logs",
      },
      {
        key: "audit",
        label: "Audit logs",
        description: "Security-relevant actions.",
        href: "/dashboard/usage-logs/audit",
      },
      {
        key: "task",
        label: "Task logs",
        description: "Async jobs and drawing tasks.",
        href: "/dashboard/usage-logs/task",
      },
    ],
  },
  {
    key: "personal",
    label: "Personal",
    description: "Wallet, profile and account security.",
    modules: [
      {
        key: "topup",
        label: "Wallet",
        description: "Balance, top-ups and referrals.",
        href: "/dashboard/wallet",
      },
      {
        key: "personal",
        label: "Profile",
        description: "Your account details.",
        href: "/dashboard/profile",
      },
      {
        key: "security",
        label: "Security",
        description: "Sessions and credentials.",
        href: "/dashboard/security",
      },
    ],
  },
];

export type SidebarModulesConfig = Record<string, { enabled: boolean; [key: string]: boolean }>;

/** Builds the all-visible default. */
export function defaultSidebarModules(): SidebarModulesConfig {
  const config: SidebarModulesConfig = {};
  for (const section of SIDEBAR_SECTIONS) {
    config[section.key] = { enabled: true };
    for (const module of section.modules) config[section.key][module.key] = true;
  }
  return config;
}

/** Parses the stored JSON, filling any missing field with the default (visible). */
export function parseSidebarModules(raw: string | null | undefined): SidebarModulesConfig {
  const defaults = defaultSidebarModules();
  if (!raw || !raw.trim()) return defaults;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== "object") return defaults;

  const source = parsed as Record<string, unknown>;
  for (const section of SIDEBAR_SECTIONS) {
    const stored = source[section.key];
    if (!stored || typeof stored !== "object") continue;
    const storedSection = stored as Record<string, unknown>;
    if (typeof storedSection.enabled === "boolean") {
      defaults[section.key].enabled = storedSection.enabled;
    }
    for (const module of section.modules) {
      if (typeof storedSection[module.key] === "boolean") {
        defaults[section.key][module.key] = storedSection[module.key] as boolean;
      }
    }
  }
  return defaults;
}

/** Finds the module key that owns a nav href, for the visibility check. */
export function moduleKeyForHref(href: string): { section: string; module: string } | null {
  for (const section of SIDEBAR_SECTIONS) {
    for (const module of section.modules) {
      if (module.href === href) return { section: section.key, module: module.key };
    }
  }
  return null;
}

/** Whether a nav href should be shown under the given configuration. */
export function isHrefVisible(config: SidebarModulesConfig, href: string): boolean {
  const found = moduleKeyForHref(href);
  if (!found) return true;
  const section = config[found.section];
  if (!section) return true;
  if (section.enabled === false) return false;
  return section[found.module] !== false;
}
