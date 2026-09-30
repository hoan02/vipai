"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { ChevronRight, List, X } from "lucide-react";
import { TELEGRAM_URL } from "@/lib/site";
import { docByHref, docCrumbs, docNeighbours, type DocPage } from "@/lib/docs-manifest";
import { DocRail } from "./doc-rail";
import { DocOutline } from "./doc-outline";

function Crumbs({ page }: { page: DocPage | undefined }) {
  if (!page) return null;
  const trail = docCrumbs(page);
  return (
    <nav className="doc-crumbs" aria-label="Breadcrumb">
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={`${c.title}-${i}`} className="doc-crumb">
            {i > 0 ? <ChevronRight size={13} aria-hidden="true" /> : null}
            {last || !c.href ? (
              <span aria-current={last ? "page" : undefined}>{c.title}</span>
            ) : (
              <Link href={c.href}>{c.title}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Pager({ page }: { page: DocPage | undefined }) {
  if (!page) return null;
  const { prev, next } = docNeighbours(page.slug);
  if (!prev && !next) return null;
  return (
    <nav className="doc-pager" aria-label="Previous and next page">
      {prev ? (
        <Link className="doc-pager-link is-prev" href={prev.href}>
          <span className="doc-pager-dir">Previous</span>
          <span className="doc-pager-title">{prev.title}</span>
        </Link>
      ) : (
        <span className="doc-pager-spacer" aria-hidden="true" />
      )}
      {next ? (
        <Link className="doc-pager-link is-next" href={next.href}>
          <span className="doc-pager-dir">Next</span>
          <span className="doc-pager-title">{next.title}</span>
        </Link>
      ) : (
        <span className="doc-pager-spacer" aria-hidden="true" />
      )}
    </nav>
  );
}

function DocMeta({ page }: { page: DocPage | undefined }) {
  if (!page?.minutes) return null;
  return (
    <div className="doc-meta">
      <span>{page.minutes} min read</span>
      <span>API v1</span>
      <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
        Report a problem
      </a>
    </div>
  );
}

/**
 * Documentation layout: rail, prose, on-page outline.
 *
 * The page body arrives as `children`, so the prose itself stays a server
 * component while the navigation layer is interactive.
 */
export function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const page = docByHref(pathname);
  const [drawer, setDrawer] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const close = useCallback(() => setDrawer(false), []);

  useEffect(() => {
    close();
    setOutlineOpen(false);
  }, [pathname, close]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer, close]);

  return (
    <div className="doc-shell">
      <button
        type="button"
        className="doc-drawer-btn"
        aria-label="Browse documentation"
        aria-expanded={drawer}
        onClick={() => setDrawer(true)}
      >
        <List size={18} aria-hidden="true" />
        <span>Docs</span>
      </button>

      <div className={`doc-scrim${drawer ? " is-on" : ""}`} onClick={close} aria-hidden="true" />

      <aside className={`doc-aside${drawer ? " is-open" : ""}`} aria-label="Documentation navigation">
        <button type="button" className="doc-drawer-close" aria-label="Close navigation" onClick={close}>
          <X size={18} aria-hidden="true" />
        </button>
        <DocRail onNavigate={close} />
      </aside>

      <main className="doc-main">
        <div className="doc-main-head">
          <Crumbs page={page} />
          <button
            type="button"
            className="doc-outline-toggle"
            aria-expanded={outlineOpen}
            onClick={() => setOutlineOpen((v) => !v)}
          >
            On this page
            <ChevronRight size={15} aria-hidden="true" className={outlineOpen ? "is-open" : undefined} />
          </button>
        </div>

        {/* Mounted only when opened, so the desktop outline is not joined by a
            second observer watching the same headings. */}
        {outlineOpen ? (
          <div className="doc-outline-mobile is-open">
            <DocOutline />
          </div>
        ) : null}

        <article className="doc-body" id="doc-body">
          <h1 className="doc-title">{page?.title ?? "Documentation"}</h1>
          <DocMeta page={page} />
          {children}
        </article>

        <Pager page={page} />
      </main>

      <aside className="doc-aside-right">
        <DocOutline
          lead={
            <p>
              Cannot find it?{" "}
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
                Ask with a request id
              </a>{" "}
              and we will point at the right page.
            </p>
          }
        />
      </aside>
    </div>
  );
}
