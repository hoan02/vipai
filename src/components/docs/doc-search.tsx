"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { DOC_PAGES, type DocPage } from "@/lib/docs-manifest";

type SectionHit = { id: string; label: string; level: 2 | 3; body: string };
type PageHit = { page: DocPage; score: number };
type Snippet = { before: string; match: string; after: string };

function terms(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Build a snippet around the first hit, split so the match can be marked. */
function snippet(text: string, q: string, radius = 52): Snippet {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) {
    const head = text.slice(0, radius * 2).trimEnd();
    return { before: head + (text.length > head.length ? "…" : ""), match: "", after: "" };
  }
  const from = Math.max(0, i - radius);
  const slice = text.slice(from, from + radius * 3);
  const rel = slice.toLowerCase().indexOf(q);
  if (rel < 0) return { before: slice, match: "", after: "" };
  return {
    before: (from > 0 ? "…" : "") + slice.slice(0, rel),
    match: slice.slice(rel, rel + q.length),
    after: slice.slice(rel + q.length) + (text.length > from + radius * 3 ? "…" : ""),
  };
}

function SnippetText({ s }: { s: Snippet }) {
  if (!s.match) return <>{s.before}</>;
  return (
    <>
      {s.before}
      <em>{s.match}</em>
      {s.after}
    </>
  );
}

/**
 * Mark every query term in a short string. Used for the page-level results,
 * where the hit is in the title, the summary or the keyword index rather than
 * in a body snippet — without this those rows came back with nothing lit up.
 */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) && p.trim() !== "" && terms.some((t) => t.toLowerCase() === p.toLowerCase()) ? (
          <em key={i}>{p}</em>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Height of the sticky chrome, read from the tokens so it cannot drift. */
function stickyOffset(): number {
  if (typeof window === "undefined") return 120;
  const cs = getComputedStyle(document.documentElement);
  const lb = parseFloat(cs.getPropertyValue("--lb-h")) || 0;
  const nav = parseFloat(cs.getPropertyValue("--nav-h")) || 0;
  return lb + nav + 18;
}

export function DocSearch({ slug }: { slug: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<SectionHit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = q.trim();
  const ts = useMemo(() => terms(trimmed), [trimmed]);

  /**
   * The section list is read from the rendered DOM once, on mount, rather than
   * being declared twice. That is what lets search find the word "cache" in the
   * body of a page without the prose also living in a hand-written index.
   */
  useEffect(() => {
    const root = document.getElementById("doc-body");
    if (!root) return;
    const full = (root.textContent ?? "").replace(/\s+/g, " ");
    const found: SectionHit[] = [];
    root.querySelectorAll<HTMLElement>("h2[id], h3[id]").forEach((h) => {
      const label = (h.textContent ?? "").replace(/#\s*$/, "").trim();
      if (!label) return;
      const start = full.indexOf(label);
      found.push({
        id: h.id,
        label,
        level: h.tagName === "H2" ? 2 : 3,
        body: start >= 0 ? full.slice(start + label.length, start + label.length + 400) : "",
      });
    });
    setSections(found);
  }, [slug]);

  const { here, elsewhere, total } = useMemo(() => {
    if (!trimmed) return { here: [] as Array<SectionHit & { snip: Snippet }>, elsewhere: [] as PageHit[], total: 0 };
    const lq = trimmed.toLowerCase();

    const onThisPage = sections
      .filter((s) => ts.every((t) => s.label.toLowerCase().includes(t)))
      .slice(0, 6)
      .map((s) => ({ ...s, snip: snippet(s.body, lq) }));

    const pages: PageHit[] = [];
    for (const page of DOC_PAGES) {
      if (page.status !== "live") continue;
      const hay = [page.title, page.summary, ...(page.keywords ?? [])].join(" ").toLowerCase();
      if (!ts.every((t) => hay.includes(t))) continue;
      let score = 0;
      if (page.title.toLowerCase().includes(lq)) score += 10;
      for (const t of ts) if (page.title.toLowerCase().includes(t)) score += 4;
      if (page.slug === slug) score -= 6;
      pages.push({ page, score });
    }
    pages.sort((a, b) => b.score - a.score);

    return { here: onThisPage, elsewhere: pages.slice(0, 5), total: onThisPage.length + pages.length };
  }, [trimmed, ts, sections, slug]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /** Scroll a heading into view, compensating for the sticky chrome ourselves. */
  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset();
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const go = useCallback(
    (href: string | null, hash?: string) => {
      setOpen(false);
      setQ("");
      if (hash) {
        const el = document.getElementById(hash);
        if (el) {
          jump(hash);
          window.history.replaceState(null, "", `#${hash}`);
          return;
        }
      }
      if (href && href !== window.location.pathname) router.push(href);
    },
    [router, jump],
  );

  const showPanel = open && trimmed.length > 0;
  const otherPages = elsewhere.filter((h) => h.page.slug !== slug);

  return (
    <div className="doc-find" ref={boxRef}>
      <div className="doc-find-in">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder="Search the docs…"
          aria-label="Search the documentation"
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              const first = boxRef.current?.querySelector<HTMLButtonElement>(".doc-find-panel button");
              if (first) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>

      {showPanel ? (
        <div className="doc-find-panel" role="region" aria-label="Search results">
          {total === 0 ? (
            <p className="doc-find-empty">
              Nothing matches “{trimmed}”. Try <b>cache</b>, <b>curl</b>, <b>fast mode</b>, <b>401</b> or{" "}
              <b>service_tier</b>.
            </p>
          ) : (
            <>
              {here.length > 0 ? (
                <>
                  <p className="doc-find-count">On this page</p>
                  {here.map((s) => (
                    <button key={s.id} type="button" className="doc-find-row" onClick={() => go(null, s.id)}>
                      <b>
                        <span className={`doc-find-lv is-lv${s.level}`} aria-hidden="true" />
                        {s.label}
                      </b>
                      <span>
                        <SnippetText s={s.snip} />
                      </span>
                    </button>
                  ))}
                </>
              ) : null}

              {otherPages.length > 0 ? (
                <>
                  <p className="doc-find-count">Other pages</p>
                  {otherPages.map((h) => (
                    <button
                      key={h.page.slug}
                      type="button"
                      className="doc-find-row"
                      onClick={() => go(h.page.href)}
                    >
                      <b>{h.page.title}</b>
                      <span>
                        <Marked text={h.page.summary} terms={ts} />
                      </span>
                    </button>
                  ))}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
