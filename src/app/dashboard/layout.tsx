import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./dashboard.css";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireAccountOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Dashboard — VipAI",
};

/**
 * The signed-out gate for every dashboard page.
 *
 * It lives in the layout so the check happens once for the whole section: a page
 * that renders here can assume a session, and a visitor without one is sent to
 * sign-in with the page they wanted preserved.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAccountOrRedirect();
  return <DashboardShell>{children}</DashboardShell>;
}
