"use client";

import { useEffect, useRef } from "react";
import { useLocale as useIntlLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";

/**
 * The DOM sweep, on its way out.
 *
 * It still rewrites rendered copy, but it no longer *owns* the locale: the
 * locale comes from the URL via next-intl, so the sweep agrees with the page it
 * is on instead of overriding it from `localStorage`. Nothing here writes
 * `documentElement.lang` any more — the server sets that from the same URL.
 *
 * Phase 2 replaces the string-by-string lookups with `useTranslations` and
 * deletes this file; until then it keeps the handful of surfaces that are still
 * authored as plain English readable in Vietnamese.
 *
 * Two things keep it off the critical path of the public site:
 *
 *  - The 719-entry dictionary is imported dynamically, and only when the sweep
 *    actually runs, so a marketing page never downloads it. As a static import
 *    of this module — which the root layout mounts on every route — it used to
 *    sit in the first-load script set of every page.
 *  - The sweep only runs on the routes that still need it. `needsSweep` lists
 *    them; everything else (the marketing pages, docs, and the pages whose prose
 *    moved to `useTranslations` in the same change) is skipped, so the pass does
 *    not walk a DOM it cannot rewrite. The pass itself measures ~1ms, so this is
 *    about the dictionary, not the walk.
 */

export type Locale = "en" | "vi";

/**
 * Locale as React state, for components that resolve their own copy in JSX
 * instead of leaving it to the DOM pass below. It reads next-intl, which reads
 * the URL — no dictionary, so importing it stays cheap.
 */
export function useLocale(): Locale {
  return useIntlLocale() === "vi" ? "vi" : "en";
}

/** Fired to ask for another sweep. Dialogs and other late-mounting surfaces
 *  call this right after they open, because the pass only sees markup that is
 *  in the document when it runs. */
const REFRESH_EVENT = "vipai:i18n-refresh";

export function refreshTranslations() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/**
 * Routes whose copy is still authored as plain English and translated here.
 *
 * The public site is done: `QuickStart`, `LiveDiscounts` and the `/pricing`
 * prose moved to `useTranslations`, `about`/`download`/`models` are server
 * translated, and docs are English-only. What remains is the dashboard tree
 * (the chat, playground, profile and security views), the admin tree, and the
 * legal drafts' headings. Keep this list in step with the migration status in
 * the README: a route that still needs the sweep and is missing here would
 * serve English copy to a Vietnamese reader.
 */
function needsSweep(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/legal" ||
    pathname.startsWith("/legal/")
  );
}

// Inline chrome: leaf text nodes (nav links, buttons, pills, chips).
const INLINE_SELECTOR = "a,button,span,label,small,strong,b,em";
// Block prose: matched by normalised textContent so inline <code>/<strong>
// inside a paragraph does not break the lookup.
const BLOCK_SELECTOR = "h1,h2,h3,h4,p,li,td,th,dt,dd,caption,figcaption,summary";

/**
 * A subtree that has been migrated to `useTranslations` opts out of the sweep.
 *
 * Both passes edit the DOM in place, which is only safe while React is not also
 * rendering the same nodes. A migrated component *is* rendered by React, so the
 * sweep must not touch it — otherwise the block pass, which rewrites
 * `innerHTML`, can replace an anchor with a bare string. The guard disappears
 * with this file once the last component is migrated.
 */
const SKIP_SELECTOR = "[data-i18n-skip]";

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();

/** Fills the `{n}` a dynamic phrase is keyed on, so a figure that comes from
 *  live data (e.g. the top discount) can still be translated: the dictionary
 *  holds "up to {n}% off", the element carries the value in `data-i18n-n`. */
const fill = (text: string, n: string | null) => (n === null ? text : text.replace(/\{n\}/g, n));

function directTextNodes(el: Element): Text[] {
  const nodes: Text[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) nodes.push(n as Text);
  }
  return nodes;
}

type InlineEntry = { el: Element; key: string; nodes: Text[]; n: string | null };
type BlockEntry = { el: Element; key: string; html: string; n: string | null };

/**
 * Builds the sweep over a loaded dictionary.
 *
 * The element caches hold each node's *pre-translation* text, so they must
 * survive a locale change and a client navigation: rebuilding them after the
 * DOM has already been rewritten would capture the previous language as the
 * "source". They therefore close over this function's scope and live as long as
 * `applyRef` points at the returned `run`.
 */
function createSweep(vi: Record<string, string>, localeRef: { current: Locale }): () => void {
  const en: Record<string, string> = Object.fromEntries(Object.entries(vi).map(([k, v]) => [v, k]));
  const inlineCache = new Map<Element, InlineEntry>();
  const blockCache = new Map<Element, BlockEntry>();

  return () => {
    const active = localeRef.current;

    // 1) inline chrome pass
    const handled = new Set<Element>();
    document.querySelectorAll(INLINE_SELECTOR).forEach((el) => {
      if (el.closest(SKIP_SELECTOR)) return;
      let entry = inlineCache.get(el);
      if (!entry) {
        const nodes = directTextNodes(el);
        if (!nodes.length) return;
        const currentText = nodes.map((n) => n.nodeValue || "").join("").trim();
        const key = el.getAttribute("data-i18n") || (vi[currentText] ? currentText : en[currentText] || "");
        if (!key || !vi[key]) return;
        el.setAttribute("data-i18n", key);
        entry = { el, key, nodes, n: el.getAttribute("data-i18n-n") };
        inlineCache.set(el, entry);
      }
      const text = fill(active === "vi" ? vi[entry.key] : entry.key, entry.n);
      entry.nodes[0].nodeValue = text;
      for (let i = 1; i < entry.nodes.length; i++) entry.nodes[i].nodeValue = "";
      handled.add(el);
      let p = el.parentElement;
      while (p) {
        handled.add(p);
        p = p.parentElement;
      }
    });

    // 2) block prose pass (skip blocks already covered by the inline pass)
    document.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
      if (handled.has(el) || el.closest(SKIP_SELECTOR)) return;
      let entry = blockCache.get(el);
      if (!entry) {
        const currentText = norm(el.textContent || "");
        const key = el.getAttribute("data-i18n") || (vi[currentText] ? currentText : en[currentText] || "");
        if (!key || !vi[key]) return;
        el.setAttribute("data-i18n", key);
        const initialHtml = el.innerHTML;
        entry = {
          el,
          key,
          html: en[currentText] ? en[currentText] || initialHtml : initialHtml,
          n: el.getAttribute("data-i18n-n"),
        };
        blockCache.set(el, entry);
      }
      el.innerHTML = fill(active === "vi" ? vi[entry.key] : entry.html, entry.n);
    });
  };
}

export function I18n() {
  const locale = useLocale();
  const pathname = usePathname();
  const applyRef = useRef<() => void>(() => {});
  const sweptRef = useRef(false);
  // The caches hold the original, untranslated text of each element, so they
  // must survive a locale change and a client navigation: rebuilding them after
  // the DOM has already been rewritten would capture the previous language as
  // the "source". They therefore live for the session, not for one render of
  // the route that first needed them.
  const localeRef = useRef<Locale>(locale);
  localeRef.current = locale;

  useEffect(() => {
    if (sweptRef.current || !needsSweep(pathname)) return;

    let disposed = false;
    void (async () => {
      // Fetched on demand: this is the ~65KB dictionary, and only the routes
      // still swept here ever ask for it.
      const { vi } = await import("@/lib/i18n-data");
      if (disposed) return;
      sweptRef.current = true;
      applyRef.current = createSweep(vi, localeRef);
      applyRef.current();
    })();

    return () => {
      disposed = true;
    };
  }, [pathname]);

  // A dialog that mounts after the first pass asks for another one.
  useEffect(() => {
    const run = () => applyRef.current();
    window.addEventListener(REFRESH_EVENT, run);
    return () => window.removeEventListener(REFRESH_EVENT, run);
  }, []);

  // Re-apply after a locale switch or a client-side navigation so the new
  // route's content is covered. Guarded so a navigation out of a swept route
  // does not walk a DOM that has nothing to translate.
  useEffect(() => {
    if (needsSweep(pathname)) applyRef.current();
  }, [locale, pathname]);

  return null;
}
