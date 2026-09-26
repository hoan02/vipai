import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./site-pages.css";
import { I18n } from "@/components/I18n";

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
  title: "AiGiare — The LLM router built for Claude Code and Codex",
  description:
    "AiGiare is an AI API gateway for developers: one key for GPT, Claude, Gemini and other leading models.",
  icons: {
    icon: [{ url: "/aigiare.svg", type: "image/svg+xml" }],
    shortcut: ["/aigiare.svg"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${geist.variable} ${mono.variable}`}>
      <body>
        <I18n />
        {children}
      </body>
    </html>
  );
}