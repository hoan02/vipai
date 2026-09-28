"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Percent } from "lucide-react";
import { UserButton } from "@/components/UserButton";
import { Icon } from "@/lib/icons";

/**
 * The admin chrome.
 *
 * Two screens only: upstream cost and margin, and the revenue/cost rollup.
 * Everything else the console already does better, so this does not try to
 * duplicate it — see the note in the sidebar footer.
 */
const nav = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Margin", href: "/admin/margin", icon: Percent },
  { label: "Statistics", href: "/admin/stats", icon: BarChart3 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/admin";
  const isOn = (href: string) =>
    href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);

  return (
    <div className="dash admin">
      <header className="dash-top">
        <div className="dash-top-in">
          <Link className="dash-brand" href="/">
            <Icon name="ic-aigiare" viewBox="0 0 24 24" width={18} height={18} />
            AiGiare
            <span className="dash-crumb">Admin</span>
          </Link>
          <div className="dash-account">
            <a className="dash-tab" href="https://api.aigiare.site/console">
              Gateway console
            </a>
            <Link className="dash-tab" href="/dashboard">
              Dashboard
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="dash-wrap">
        <div className="dash-frame">
          <aside className="dash-side">
            <nav className="dash-nav" aria-label="Admin">
              {nav.map((item) => {
                const I = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isOn(item.href) ? "is-on" : undefined}
                    title={item.label}
                  >
                    <I aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <p className="note" style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5 }}>
              Users, channels, keys and the rest live in the{" "}
              <a className="link" href="https://api.aigiare.site/console">
                gateway console
              </a>
              .
            </p>
          </aside>
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
