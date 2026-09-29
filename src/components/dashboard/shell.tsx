"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Shield,
  User,
} from "lucide-react";
import { Icon } from "@/lib/icons";
import { dashboardNavGroups, type NavIcon } from "@/lib/dashboard-data";
import { TopUpModal } from "@/components/site/TopUpModal";
import { setLocale, getLocale, type Locale } from "@/components/site/I18n";

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
  const [lang, setLang] = useState<Locale>("vi");
  useEffect(() => setLang(getLocale()), []);
  const chooseLang = (l: Locale) => {
    setLang(l);
    setLocale(l);
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

  return (
    <div className="dash">
      <aside className="dash-side">
        <Link className="dash-brand" href="/">
          <Icon name="ic-vipai" viewBox="0 0 24 24" width={20} height={20} />
          VipAI
        </Link>
        <button className="dash-acct" type="button" aria-label="Switch organization">
          <span className="av" aria-hidden="true">
            {initial}
          </span>
          <span className="em">{display}</span>
          <ChevronsUpDown size={15} />
        </button>
        <nav className="dash-nav" aria-label="Dashboard">
          {dashboardNavGroups.map((group) => (
            <div className="dash-nav-group" key={group.id}>
              <span className="dash-nav-title">{group.title}</span>
              {group.items.map((item) => {
                const I = navIcons[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={item.href === activeHref ? "is-on" : undefined}
                  >
                    <I aria-hidden="true" />
                    {item.label}
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
