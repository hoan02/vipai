"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Layers, LayoutDashboard } from "lucide-react";
import { UserButton } from "@/components/UserButton";
import { Icon } from "@/lib/icons";
import { brandMark } from "@/lib/data";

/**
 * The admin chrome.
 *
 * Two screens only: per-model settings, and the revenue/cost rollup. Everything
 * else the console already does better, so this does not try to duplicate it —
 * see the note in the sidebar footer.
 */
const nav = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Models", href: "/admin/margin", icon: Layers },
  { label: "Statistics", href: "/admin/stats", icon: BarChart3 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/admin";
  const isOn = (href: string) =>
    href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);

  return (
    <div className="dash admin">
      <aside className="dash-side">
        <Link className="dash-brand" href="/">
          <Icon name={brandMark} width={26} height={18} />
          VipAI
          <span className="dash-crumb">Admin</span>
        </Link>
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
        <p className="note dash-side-note">
          Users, channels, keys and the rest live in the{" "}
          <a className="link" href="https://api.vipai.site/console">
            gateway console
          </a>
          .
        </p>
      </aside>

      <div className="dash-body">
        <header className="dash-top">
          <div className="dash-top-in">
            <div className="dash-account">
              <a className="dash-tab" href="https://api.vipai.site/console">
                Gateway console
              </a>
              <Link className="dash-tab" href="/dashboard">
                Dashboard
              </Link>
              <UserButton />
            </div>
          </div>
        </header>

        <div className="dash-scroll" key={path}>
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
