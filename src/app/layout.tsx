import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./site-pages.css";
import { I18n } from "@/components/site/I18n";
import { AuthModal } from "@/components/site/AuthModal";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

// Fonts are self-hosted so `next build` never reaches Google Fonts. The deploy
// builds inside a container where that fetch fails intermittently, which trips
// Turbopack's Google-font loader ("Can't resolve
// @vercel/turbopack-next/internal/font/google/font"). These are the latin
// subsets the previous `next/font/google` config downloaded, kept as variable
// files so every weight stays available.
const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  weight: "100 800",
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VipAI — The LLM router built for Claude Code and Codex",
  description:
    "VipAI is an AI API gateway for developers: one key for GPT, Claude, Gemini and other leading models.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "64x64" }],
    shortcut: ["/favicon.png"],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
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