import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * Every internal link in the app must come from here once the `[locale]`
 * segment exists: `next/link` on its own drops the prefix, which sends a
 * Vietnamese reader back to the English tree on the first click. The one
 * exception is `/api` and the auth proxy, which are locale-neutral.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
