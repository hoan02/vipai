"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Percent,
  Server,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import { UserButton } from "@/components/UserButton";
import { Icon } from "@/lib/icons";

const nav = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Channels", href: "/admin/channels", icon: Server },
  { label: "Pricing", href: "/admin/pricing", icon: Tags },
  { label: "Margin", href: "/admin/margin", icon: Percent },
  { label: "Statistics", href: "/admin/stats", icon: BarChart3 },
  { label: "Redemptions", href: "/admin/redemptions", icon: Ticket },
  { label: "Accounts", href: "/admin/users", icon: Users },
  { label: "Models", href: "/admin/models", icon: Boxes },
];

/** A compact admin chrome: a slim rail, a thin top bar, no page filler. */
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
          </aside>
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
