"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { vi } from "@/lib/i18n-data";

const STORAGE_KEY = "aigiare.locale";
export const LOCALE_EVENT = "aigiare:locale";
export type Locale = "en" | "vi";

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
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) === "vi" ? "vi" : "en";
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
          const key = nodes.map((n) => n.nodeValue || "").join("").trim();
          if (!vi[key]) return;
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
          const key = norm(el.textContent || "");
          if (!vi[key]) return;
          entry = { el, key, html: el.innerHTML };
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
