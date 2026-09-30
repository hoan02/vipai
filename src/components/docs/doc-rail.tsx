"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Icon } from "@/lib/icons";
import { docByHref, docGroups, plannedGroups } from "@/lib/docs-manifest";
import { DocSearch } from "./doc-search";

function PageGlyph({ mark, glyph: Glyph }: { mark?: string; glyph?: React.ComponentType<{ size?: number }> }) {
  if (mark) return <Icon name={mark} width={16} height={16} />;
  if (Glyph) return <Glyph size={16} />;
  return null;
}

/**
 * The documentation rail.
 *
 * Only pages that exist are rendered as links. The backlog lives in its own
 * group as non-interactive rows with a "planned" chip, so the rail never shows
 * navigation that goes nowhere — which is what the old shell did with 13 of its
 * 15 entries.
 */
export function DocRail({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const groups = docGroups();
  const planned = plannedGroups();

  useEffect(() => {
    setCollapsed(false);
  }, [pathname]);

  return (
    <div className={`doc-rail${collapsed ? " is-collapsed" : ""}`}>
      <div className="doc-rail-bar">
        <button
          type="button"
          className="doc-rail-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </div>

      {!collapsed ? (
        <>
          <DocSearch slug={docByHref(pathname)?.slug ?? "overview"} />

          <nav className="doc-rail-nav" aria-label="Documentation">
            {groups.map((g) => (
              <div className="doc-rail-group" key={g.id}>
                <p className="doc-rail-title">{g.title}</p>
                {g.pages.map((p) => {
                  const active = pathname === p.href;
                  return (
                    <Link
                      key={p.slug}
                      href={p.href}
                      className="doc-rail-item"
                      aria-current={active ? "page" : undefined}
                      title={p.summary}
                      onClick={onNavigate}
                    >
                      <span className="doc-rail-ico">
                        <PageGlyph mark={p.mark} glyph={p.glyph} />
                      </span>
                      <span>{p.title}</span>
                    </Link>
                  );
                })}
              </div>
            ))}

            {planned.length > 0 ? (
              <div className="doc-rail-planned">
                <p className="doc-rail-title">
                  Planned <span className="doc-rail-chip">roadmap</span>
                </p>
                {planned.map((g) => (
                  <div className="doc-rail-group" key={g.id}>
                    <p className="doc-rail-subtitle">{g.title}</p>
                    {g.pages.map((p) => (
                      <span key={p.slug} className="doc-rail-item is-plan" title={`Not published yet — ${p.summary}`}>
                        <span className="doc-rail-ico">
                          <PageGlyph mark={p.mark} glyph={p.glyph} />
                        </span>
                        <span>{p.title}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </nav>
        </>
      ) : null}
    </div>
  );
}
