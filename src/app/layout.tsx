import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./site-pages.css";
import { I18n } from "@/components/site/I18n";
import { AuthModal } from "@/components/site/AuthModal";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-geist",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VipAI — The LLM router built for Claude Code and Codex",
  description:
    "VipAI is an AI API gateway for developers: one key for GPT, Claude, Gemini and other leading models.",
  icons: {
    icon: [{ url: "/vipai.svg", type: "image/svg+xml" }],
    shortcut: ["/vipai.svg"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets data-theme on <html> before
    // React hydrates, so the server and client class/attribute lists differ by
    // design. This only silences the warning on this one element.
    <html lang="vi" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <I18n />
          {children}
          <AuthModal />
          <CommandPalette />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}