import type { ReactNode } from "react";

/**
 * Section headings for documentation pages.
 *
 * No heading carries a hand-typed number. The `4.4` / `4.7` desync that used to
 * live in the API page happened because authors typed digits into prose and the
 * digits went stale the moment a section was inserted. The outline derives its
 * numbering from document order instead, and cross-references are anchor links
 * rather than "see section 4".
 */

function AnchorLink({ id }: { id: string }) {
  return (
    <a className="doc-anchor" href={`#${id}`} aria-label="Link to this section">
      #
    </a>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id}>
      {children}
      <AnchorLink id={id} />
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id}>
      {children}
      <AnchorLink id={id} />
    </h3>
  );
}

/**
 * Numbered install steps. The number lives in the heading so the on-page
 * outline can show it too, and it appears exactly once.
 */
export function Steps({ children }: { children: ReactNode }) {
  return <div className="doc-steps">{children}</div>;
}

export function Step({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="doc-step">
      <H3 id={id}>{title}</H3>
      {children}
    </section>
  );
}
