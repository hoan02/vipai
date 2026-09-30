import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../dashboard/dashboard.css";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireRoot } from "@/server/admin";
import { isLocale, localePath, routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The admin area.
 *
 * A separate route tree from `/dashboard` with its own sidebar, so admin
 * functions can grow without crowding one page. Gated on the root account; a
 * non-root visitor is sent back to their dashboard.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const active = isLocale(locale) ? locale : routing.defaultLocale;

  let access: Awaited<ReturnType<typeof requireRoot>> | null = null;
  try {
    access = await requireRoot();
  } catch {
    access = null;
  }
  if (!access) redirect(localePath(active, "/dashboard"));

  return <AdminShell>{children}</AdminShell>;
}
