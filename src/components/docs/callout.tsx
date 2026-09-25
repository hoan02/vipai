import type { ReactNode } from "react";

export type CalloutKind = "info" | "warn" | "ok" | "plain";

const GLYPH: Record<CalloutKind, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9.4" />
      <path d="M12 11v5.5M12 7.6h.01" />
    </>
  ),
  warn: (
    <>
      <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.4v4.2M12 17.2h.01" />
    </>
  ),
  ok: <path d="m4.5 12.5 5 5 10-11" />,
  plain: (
    <>
      <circle cx="12" cy="12" r="9.4" />
      <path d="M12 11v5.5M12 7.6h.01" />
    </>
  ),
};

/**
 * Four kinds so "this is required" does not read like "this will bite you".
 * Each kind pairs a background, a 3px left rule and a text colour that clears
 * 4.5:1 on that background.
 */
export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: CalloutKind;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className={`doc-callout is-${kind}`} role="note">
      <svg className="doc-callout-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {GLYPH[kind]}
      </svg>
      <div className="doc-callout-body">
        {title ? <b className="doc-callout-title">{title}</b> : null}
        {children}
      </div>
    </aside>
  );
}
