"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSession } from "@/lib/auth-client";
import { UserButton } from "@/components/UserButton";
import {
  BarChart3,
  ChevronsUpDown,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Gauge,
  KeyRound,
  ListTodo,
  MessageSquare,
  ScrollText,
  Search,
  Shield,
  User,
} from "lucide-react";
import { Icon } from "@/lib/icons";
import { brandMark } from "@/lib/data";
import { openCommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { dashboardNavGroups, type NavIcon } from "@/lib/dashboard-data";
import { isHrefVisible, parseSidebarModules } from "@/lib/sidebar-modules";
import { TopUpModal } from "@/components/site/overlays";
import { useLocale, type Locale } from "@/components/site/I18n";

const navIcons: Record<NavIcon, typeof Gauge> = {
  gauge: Gauge,
  flask: FlaskConical,
  chat: MessageSquare,
  bars: BarChart3,
  key: KeyRound,
  scroll: ScrollText,
  audit: ClipboardList,
  tasks: ListTodo,
  credit: CreditCard,
  user: User,
  shield: Shield,
};

const topTabs = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Connect Codex", href: "/download" },
  { label: "API docs", href: "/docs" },
  { label: "Dashboard", href: "/dashboard" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/dashboard";
  const router = useRouter();
  const t = useTranslations("dash");
  // The URL is the locale; the picker navigates rather than writing a store.
  const lang = useLocale();
  const chooseLang = (l: Locale) => {
    if (l !== lang) router.replace(path, { locale: l });
  };

  // Highlight exactly one link: the longest href that still matches the path.
  // This keeps "Usage logs" quiet while "Audit logs" (/usage-logs/audit) is open.
  const activeHref = useMemo(() => {
    const items = dashboardNavGroups.flatMap((group) => group.items);
    let best: string | null = null;
    for (const item of items) {
      const matched = item.exact
        ? path === item.href
        : path === item.href || path.startsWith(`${item.href}/`);
      if (matched && (best === null || item.href.length > best.length)) best = item.href;
    }
    return best;
  }, [path]);

  const { data: session } = useSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const email = (user?.email as string | undefined) ?? "";
  const display =
    (user?.name as string | undefined) || (user?.username as string | undefined) || email;
  const initial = (display.trim()[0] ?? "A").toUpperCase();

  // The visitor's saved sidebar preferences narrow the default navigation; an
  // account that never touched them keeps every entry (missing means visible).
  const navGroups = useMemo(() => {
    const config = parseSidebarModules(user?.sidebarModules as string | undefined);
    return dashboardNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isHrefVisible(config, item.href)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user?.sidebarModules]);

  return (
    <div className="dash">
      <aside className="dash-side">
        <Link className="dash-brand" href="/">
          <Icon name={brandMark} width={29} height={20} />
          VipAI
        </Link>
        <button className="dash-acct" type="button" aria-label={t("switchOrg")}>
          <span className="av" aria-hidden="true">
            {initial}
          </span>
          <span className="em">{display}</span>
          <ChevronsUpDown size={15} />
        </button>
        <nav className="dash-nav" aria-label={t("navLabel")}>
          {navGroups.map((group) => (
            <div className="dash-nav-group" key={group.id}>
              <span className="dash-nav-title">{t(group.titleKey)}</span>
              {group.items.map((item) => {
                const I = navIcons[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={item.href === activeHref ? "is-on" : undefined}
                  >
                    <I aria-hidden="true" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="dash-body">
        <header className="dash-top">
          <div className="dash-top-in">
            <nav className="dash-tabs" aria-label="Primary">
              {topTabs.map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className={`dash-tab${t.href === "/dashboard" ? " is-on" : ""}`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="dash-account">
              <button
                className="dash-search"
                type="button"
                onClick={openCommandPalette}
                aria-label="Search pages and actions"
              >
                <Search size={15} aria-hidden="true" />
                <span className="dash-search-tx">Search</span>
                <kbd className="dash-search-kbd">⌘K</kbd>
              </button>
              <ThemeToggle className="dash-theme" />
              <div className="dash-lang" role="group" aria-label="Language">
                {(["en", "vi"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={lang === l ? "is-on" : undefined}
                    aria-pressed={lang === l}
                    onClick={() => chooseLang(l)}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="dash-user">
                <UserButton />
              </span>
            </div>
          </div>
        </header>

        <div className="dash-scroll" key={path}>
          <main className="dash-main">{children}</main>
        </div>
      </div>

      <TopUpModal />
    </div>
  );
}
