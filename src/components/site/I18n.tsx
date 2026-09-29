"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { vi } from "@/lib/i18n-data";

const STORAGE_KEY = "vipai.locale";
export const LOCALE_EVENT = "vipai:locale";
export type Locale = "en" | "vi";

const en: Record<string, string> = Object.fromEntries(
  Object.entries(vi).map(([k, v]) => [v, k])
);

/**
 * Locale as React state, for components that resolve their own copy in JSX
 * instead of leaving it to the DOM pass below (the dialog does: it re-renders
 * on every mode/status change, so its text has to come from state).
 */
export function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>("vi");

  useEffect(() => {
    setLocaleState(getLocale());
    const onLocale = (ev: Event) => {
      const next = (ev as CustomEvent<Locale>).detail;
      if (next !== "en" && next !== "vi") return;
      setLocaleState(next);
    };
    window.addEventListener(LOCALE_EVENT, onLocale);
    return () => window.removeEventListener(LOCALE_EVENT, onLocale);
  }, []);

  return locale;
}

/** Resolves copy authored in Vietnamese into the active locale. */
export function useT(): (viText: string) => string {
  const locale = useLocale();
  return useCallback((viText: string) => (locale === "en" ? en[viText] ?? viText : viText), [locale]);
}

/**
 * Re-runs the DOM pass below. The DOM sweep only sees markup that is in the
 * document when it fires, so dialogs and other late-mounting surfaces ask for
 * one sweep of their own right after they open.
 */
export function refreshTranslations() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Locale>(LOCALE_EVENT, { detail: getLocale() }));
}

// Inline chrome: leaf text nodes (nav links, buttons, pills, chips).
const INLINE_SELECTOR = "a,button,span,label,small,strong,b,em";
// Block prose: matched by normalised textContent so inline <code>/<strong>
// inside a paragraph does not break the lookup.
const BLOCK_SELECTOR = "h1,h2,h3,h4,p,li,td,th,dt,dd,caption,figcaption,summary";

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();

function directTextNodes(el: Element): Text[] {
  const nodes: Text[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) nodes.push(n as Text);
  }
  return nodes;
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return "vi";
  return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "vi";
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new CustomEvent<Locale>(LOCALE_EVENT, { detail: locale }));
}

type InlineEntry = { el: Element; key: string; nodes: Text[] };
type BlockEntry = { el: Element; key: string; html: string };

export function I18n() {
  const pathname = usePathname();
  const applyRef = useRef<() => void>(() => {});

  useEffect(() => {
    let locale: Locale = getLocale();
    const inlineCache = new Map<Element, InlineEntry>();
    const blockCache = new Map<Element, BlockEntry>();

    const run = () => {
      // 1) inline chrome pass
      const handled = new Set<Element>();
      document.querySelectorAll(INLINE_SELECTOR).forEach((el) => {
        let entry = inlineCache.get(el);
        if (!entry) {
          const nodes = directTextNodes(el);
          if (!nodes.length) return;
          const currentText = nodes.map((n) => n.nodeValue || "").join("").trim();
          const key = el.getAttribute("data-i18n") || (vi[currentText] ? currentText : en[currentText] || "");
          if (!key || !vi[key]) return;
          el.setAttribute("data-i18n", key);
          entry = { el, key, nodes };
          inlineCache.set(el, entry);
        }
        const text = locale === "vi" ? vi[entry.key] : entry.key;
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
        if (handled.has(el)) return;
        let entry = blockCache.get(el);
        if (!entry) {
          const currentText = norm(el.textContent || "");
          const key = el.getAttribute("data-i18n") || (vi[currentText] ? currentText : en[currentText] || "");
          if (!key || !vi[key]) return;
          el.setAttribute("data-i18n", key);
          const initialHtml = el.innerHTML;
          entry = { el, key, html: en[currentText] ? (en[currentText] || initialHtml) : initialHtml };
          blockCache.set(el, entry);
        }
        el.innerHTML = locale === "vi" ? vi[entry.key] : entry.html;
      });

      document.documentElement.lang = locale;
    };
    applyRef.current = run;

    const onLocale = (ev: Event) => {
      const next = (ev as CustomEvent<Locale>).detail;
      if (next !== "en" && next !== "vi") return;
      locale = next;
      localStorage.setItem(STORAGE_KEY, next);
      run();
    };

    run();
    window.addEventListener(LOCALE_EVENT, onLocale);
    return () => window.removeEventListener(LOCALE_EVENT, onLocale);
  }, []);

  // Re-apply after client-side navigation so new route content is covered.
  useEffect(() => {
    applyRef.current();
  }, [pathname]);

  return null;
}
