import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./dashboard.css";
import { DashboardShell } from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: "Dashboard — AiGiare",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
