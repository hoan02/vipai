"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string; level: 2 | 3 };

/**
 * The on-page outline.
 *
 * Headings are discovered from the rendered document rather than declared a
 * second time in a parallel array — which is how the old shell ended up with a
 * `nav` list nobody rendered. The rail is a full-height flex column with its
 * footer pinned to the bottom, so entries appearing after hydration move
 * nothing that the reader can see.
 */
export function DocOutline({ lead }: { lead?: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    const root = document.getElementById("doc-body");
    if (!root) return;
    const found: Item[] = [];
    root.querySelectorAll<HTMLElement>("h2[id], h3[id]").forEach((h) => {
      const label = (h.textContent ?? "").replace(/#\s*$/, "").trim();
      if (label) found.push({ id: h.id, label, level: h.tagName === "H2" ? 2 : 3 });
    });
    setItems(found);
    setCurrent(found[0]?.id ?? "");

    if (typeof IntersectionObserver === "undefined") return;

    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        // Highlight the topmost visible heading, so the marker tracks the
        // section the reader is actually looking at rather than the last one
        // to have crossed the line.
        const first = found.find((f) => visible.has(f.id));
        if (first) setCurrent(first.id);
        else if (visible.size > 0) {
          const top = [...visible].sort()[0];
          setCurrent(top ?? "");
        }
      },
      { rootMargin: "-120px 0px -68% 0px", threshold: 0 },
    );

    found.forEach((f) => {
      const el = document.getElementById(f.id);
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, []);

  if (items.length === 0) {
    return (
      <div className="doc-outline">
        <p className="doc-outline-title">On this page</p>
        <div className="doc-outline-body" />
        {lead ? <div className="doc-outline-lead">{lead}</div> : null}
      </div>
    );
  }

  let n = 0;

  return (
    <div className="doc-outline">
      <p className="doc-outline-title">On this page</p>
      <ol className="doc-outline-body">
        {items.map((it) => {
          if (it.level === 2) n += 1;
          const n2 = n;
          return (
            <li key={it.id}>
              <a
                className={`doc-outline-link is-lv${it.level}${current === it.id ? " is-current" : ""}`}
                href={`#${it.id}`}
                aria-current={current === it.id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(it.id);
                  if (!el) return;
                  const cs = getComputedStyle(document.documentElement);
                  const off =
                    (parseFloat(cs.getPropertyValue("--lb-h")) || 0) +
                    (parseFloat(cs.getPropertyValue("--nav-h")) || 0) +
                    18;
                  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" });
                  window.history.replaceState(null, "", `#${it.id}`);
                  setCurrent(it.id);
                }}
              >
                {it.level === 2 ? <span className="doc-outline-n">{n2}</span> : null}
                <span className="doc-outline-label">{it.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
      {lead ? <div className="doc-outline-lead">{lead}</div> : null}
    </div>
  );
}
