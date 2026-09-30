import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { TELEGRAM_URL } from "@/lib/site";

/** Method chip + path + auth tag: the contract, readable before the first code block. */
export function Endpoint({
  method,
  path,
  auth,
}: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth?: string;
}) {
  return (
    <div className="doc-endpoint">
      <span className="doc-method" data-method={method}>
        {method}
      </span>
      <code>{path}</code>
      {auth ? <span className="doc-endpoint-tag">{auth}</span> : null}
    </div>
  );
}

/** Two-column fact list for the handful of values a reader looks up constantly. */
export function KeyValue({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="doc-kv">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The closing call to action. One solid primary per page; the secondary is a
 * ghost button and never repeats the primary's wording.
 */
export function CtaPanel({
  title,
  text,
  primary,
  secondary,
}: {
  title: string;
  text: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <div className="doc-cta">
      <b>{title}</b>
      <p>{text}</p>
      <div className="doc-cta-acts">
        <Link className="btn btn-ghost" href={secondary.href}>
          {secondary.label}
        </Link>
        <Link className="btn btn-primary" href={primary.href}>
          {primary.label}
        </Link>
      </div>
    </div>
  );
}

/** Inline cross-reference. An anchor link, not "see section 4" — numbers drift. */
export function Ref({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link className="doc-ref" href={slug}>
      {children}
    </Link>
  );
}

export function ExternalRef({ children }: { children: ReactNode }) {
  return (
    <a className="doc-ref" href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}
