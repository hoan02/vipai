"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme context for the whole app.
 *
 * next-themes writes `data-theme="light|dark"` on <html> before first paint, so
 * the correct palette is in place before the page is visible and there is no
 * flash. `system` is the default: a visitor who never chose keeps following the
 * OS, and the toggle writes an explicit choice only when they make one.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
