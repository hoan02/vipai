import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./dashboard.css";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireAccountOrRedirect } from "@/server/auth";
import { isLocale, routing } from "@/i18n/routing";

export const metadata: Metadata = {
  // The root template already appends the brand: "Dashboard — VipAI".
  title: "Dashboard",
  // Private, session-gated surface. Keep it out of the index even though every
  // route here redirects a signed-out crawler.
  robots: { index: false, follow: false },
};

/**
 * The signed-out gate for every dashboard page.
 *
 * It lives in the layout so the check happens once for the whole section: a page
 * that renders here can assume a session, and a visitor without one is sent to
 * sign-in with the page they wanted preserved.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAccountOrRedirect(isLocale(locale) ? locale : routing.defaultLocale);
  return <DashboardShell>{children}</DashboardShell>;
}
