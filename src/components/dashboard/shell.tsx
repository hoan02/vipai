"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { UserButton } from "@/components/UserButton";
import {
  Activity,
  BarChart3,
  ChevronsUpDown,
  CreditCard,
  Gauge,
  KeyRound,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import { Icon } from "@/lib/icons";
import { dashboardNav } from "@/lib/dashboard-data";
import { TopUpModal } from "@/components/TopUpModal";
import { setLocale, getLocale, type Locale } from "@/components/I18n";

const navIcons = {
  wallet: Wallet,
  credit: CreditCard,
  sliders: Gauge,
  key: KeyRound,
  pulse: Activity,
  bars: BarChart3,
  users: Shield,
  gauge: Gauge,
  shield: Shield,
  user: User,
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
  const isOn = (href: string) =>
    href === "/dashboard" ? path === "/dashboard" : path === href || path.startsWith(`${href}/`);

  const { data: session } = useSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const email = (user?.email as string | undefined) ?? "";
  const display =
    (user?.name as string | undefined) || (user?.username as string | undefined) || email;
  const initial = (display.trim()[0] ?? "A").toUpperCase();

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-top-in">
          <Link className="dash-brand" href="/">
            <Icon name="ic-aigiare" viewBox="0 0 24 24" width={20} height={20} />
            AiGiare
          </Link>
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
              <span className="dash-email">{email}</span>
            </span>
          </div>
        </div>
      </header>

      <div className="dash-wrap">
        <div className="dash-frame">
          <aside className="dash-side">
            <button className="dash-acct" type="button" aria-label="Switch organization">
              <span className="av" aria-hidden="true">
                {initial}
              </span>
              <span className="em">{display}</span>
              <ChevronsUpDown size={15} />
            </button>
            <nav className="dash-nav" aria-label="Dashboard">
              {dashboardNav.map((item) => {
                const I = navIcons[item.icon];
                return (
                  <Link key={item.href} href={item.href} className={isOn(item.href) ? "is-on" : undefined}>
                    <I aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="dash-main">{children}</main>
        </div>
      </div>

      <TopUpModal />
    </div>
  );
}
