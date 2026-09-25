import type { ReactNode } from "react";

/**
 * Scrolls inside its own bounds with a pinned header row and a pinned first
 * column, so a seven-column catalogue stays readable without losing either the
 * model name or the column meaning.
 */
export function DocTable({
  head,
  children,
  maxHeight,
}: {
  head: ReactNode[];
  children: ReactNode;
  maxHeight?: string;
}) {
  return (
    <div className="doc-tablewrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="doc-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DocRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function DocCell({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={mono ? "is-mono" : undefined}>{children}</td>;
}

/** Yes / no / n-a pill. Used instead of a bare dash so the meaning is explicit. */
export function Pill({ tone, children }: { tone: "ok" | "no" | "flat"; children: ReactNode }) {
  return <span className={`doc-pill is-${tone}`}>{children}</span>;
}
