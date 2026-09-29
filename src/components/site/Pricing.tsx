"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/lib/icons";
import { PICK_MODEL_EVENT, brandIcon, brands, modelKey, vendors, type Model, type PickModelDetail, type Vendor } from "@/lib/data";

function ModelMark({ model, size }: { model: Model; size: number }) {
  return (
    <Icon name={brandIcon[model.vendor]} width={size} height={size} className="lg" style={{ color: brands[model.vendor] }} />
  );
}

const filters: Vendor[] = [...vendors];
const logoVendors: Vendor[] = filters.filter((v) => v !== "Featured");

function discountPct(d: string) {
  const n = parseFloat(d.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

const EXPAND_MS = 620;
const COLLAPSE_MS = 440;
/** the source waits out the expand tween before it can measure the row */
const JUMP_AFTER_EXPAND_MS = 660;
const JUMP_FLASH_MS = 1800;

export function Pricing({ models }: { models: Model[] }) {
  const [vendor, setVendor] = useState<Vendor>("Featured");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [jumped, setJumped] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const allRef = useRef<HTMLDivElement | null>(null);
  const animating = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const featured = useMemo(() => models.filter((m) => m.featured), [models]);

  const liveBadge = useMemo(
    () =>
      featured
        .filter((m) => m.disc)
        .reduce<Model | null>((best, m) => (!best || discountPct(m.disc) > discountPct(best.disc) ? m : best), null),
    [featured]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = vendor === "Featured" ? models : models.filter((m) => m.vendor === vendor);
    return q ? base.filter((m) => `${m.name} ${m.vendor}`.toLowerCase().includes(q)) : base;
  }, [vendor, query, models]);

  const tableRelRef = useRef<HTMLDivElement | null>(null);

  const syncFiltersVar = useCallback(() => {
    const section = sectionRef.current;
    const filtersEl = section?.querySelector<HTMLElement>(".price-filters");
    if (section && filtersEl) section.style.setProperty("--price-filters-h", `${Math.ceil(filtersEl.getBoundingClientRect().height)}px`);
  }, []);

  const syncBandVar = useCallback(() => {
    const tableRel = tableRelRef.current;
    if (!tableRel) return;
    const ths = tableRel.querySelectorAll<HTMLTableCellElement>("thead th");
    const thIn = ths[4]; // Input (VipAI)
    const thOut = ths[5]; // Output (VipAI)
    if (thIn && thOut) {
      const relRect = tableRel.getBoundingClientRect();
      const inRect = thIn.getBoundingClientRect();
      const outRect = thOut.getBoundingClientRect();
      if (inRect.width > 0 && outRect.width > 0) {
        tableRel.style.setProperty("--tr-band-left", `${Math.round(inRect.left - relRect.left)}px`);
        tableRel.style.setProperty("--tr-band-width", `${Math.round(outRect.right - inRect.left)}px`);
      }
    }
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (/[?&]priceall=1/.test(window.location.search)) {
      section.classList.add("show-all");
      setExpanded(true);
    }
    const onResize = () => {
      syncFiltersVar();
      syncBandVar();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncBandVar, syncFiltersVar]);

  useEffect(() => {
    const tableRel = tableRelRef.current;
    if (!tableRel || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      syncBandVar();
    });
    ro.observe(tableRel);
    return () => ro.disconnect();
  }, [syncBandVar]);

  useEffect(() => {
    if (expanded) {
      syncBandVar();
      const id = requestAnimationFrame(syncBandVar);
      return () => cancelAnimationFrame(id);
    }
  }, [expanded, rows, syncBandVar]);

  // Live badge: the source only flips the top discount badge, once it is 60% in view.
  useEffect(() => {
    const badges = Array.from(document.querySelectorAll<HTMLElement>('.pf-card[data-live-badge="true"] .pf-disc'));
    if (!badges.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) {
      badges.forEach((b) => b.classList.add("is-live"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          e.target.classList.toggle("is-live", e.isIntersecting);
          if (e.isIntersecting) io.unobserve(e.target);
        });
      },
      { threshold: 0.6 }
    );
    badges.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, [liveBadge]);

  // The animated element is #priceAll, not the section: expand tweens height +
  // margin-top .5s cubic-bezier(.22,1,.36,1) and opacity .35s ease .08s, collapse
  // .34s ease / .2s ease. Cleanup on transitionend(height) or the 620 / 440ms fallback.
  const finishExpand = useCallback(() => {
    const all = allRef.current;
    const section = sectionRef.current;
    if (all) all.style.cssText = "";
    animating.current = false;
    section?.classList.remove("is-expanding");
    syncFiltersVar();
    syncBandVar();
  }, [syncBandVar, syncFiltersVar]);

  const collapseNow = useCallback(() => {
    const section = sectionRef.current;
    const all = allRef.current;
    if (!section || !all) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      section.classList.remove("show-all");
      return;
    }
    animating.current = true;
    section.classList.add("is-expanding");
    all.style.overflow = "hidden";
    all.style.height = `${all.scrollHeight}px`;
    void all.offsetHeight;
    all.style.transition = "height .34s ease, margin-top .34s ease, opacity .2s ease";
    all.style.height = "0px";
    all.style.marginTop = "0px";
    all.style.opacity = "0";
    let done = false;
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "height") finish();
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      section.classList.remove("show-all");
      all.style.cssText = "";
      animating.current = false;
      section.classList.remove("is-expanding");
      all.removeEventListener("transitionend", onEnd);
      syncFiltersVar();
    };
    const timer = setTimeout(finish, COLLAPSE_MS);
    all.addEventListener("transitionend", onEnd);
  }, [finishExpand, syncFiltersVar]);

  const expandNow = useCallback(() => {
    const section = sectionRef.current;
    const all = allRef.current;
    if (!section || !all) return;
    section.classList.add("show-all");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) return;
    animating.current = true;
    section.classList.add("is-expanding");
    const mt = getComputedStyle(all).marginTop;
    const h = all.scrollHeight;
    all.style.overflow = "hidden";
    all.style.height = "0px";
    all.style.marginTop = "0px";
    all.style.opacity = "0";
    void all.offsetHeight;
    all.style.transition = "height .5s cubic-bezier(.22,1,.36,1), margin-top .5s cubic-bezier(.22,1,.36,1), opacity .35s ease .08s";
    all.style.height = `${h}px`;
    all.style.marginTop = mt;
    all.style.opacity = "1";
    let done = false;
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "height") finish();
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      all.removeEventListener("transitionend", onEnd);
      finishExpand();
    };
    const timer = setTimeout(finish, EXPAND_MS);
    all.addEventListener("transitionend", onEnd);
  }, [finishExpand]);

  const onToggle = useCallback(() => {
    if (animating.current) return;
    const section = sectionRef.current;
    if (!section) return;
    const expand = !section.classList.contains("show-all");
    if (expand) expandNow();
    else collapseNow();
    setExpanded(expand);
  }, [collapseNow, expandNow]);

  // Runs once the row exists in the DOM, which may be a render later than the
  // click when the jump also has to switch the vendor filter first.
  useEffect(() => {
    if (!pendingJump) return;
    const row = rowRefs.current.get(pendingJump);
    if (!row) return;
    setPendingJump(null);
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumped(pendingJump);
  }, [pendingJump, rows]);

  useEffect(() => {
    if (!jumped) return;
    const id = window.setTimeout(() => setJumped(null), JUMP_FLASH_MS);
    return () => window.clearTimeout(id);
  }, [jumped]);

  // card -> row: clear the search, make sure the row is in the current filter,
  // then centre it and flash it
  const jumpToModel = useCallback(
    (m: Model) => {
      setQuery("");
      if (vendor !== m.vendor) {
        const next = vendors.find((v) => v === m.vendor);
        if (next) setVendor(next);
      }
      const go = () => setPendingJump(m.name);
      if (sectionRef.current?.classList.contains("show-all")) {
        go();
        return;
      }
      onToggle();
      window.setTimeout(go, JUMP_AFTER_EXPAND_MS);
    },
    [onToggle, vendor]
  );

  // row / discount badge -> live section
  const openInLive = useCallback((m: Model) => {
    document.dispatchEvent(
      new CustomEvent(PICK_MODEL_EVENT, { detail: { key: modelKey(m.name), vendor: m.vendor } satisfies PickModelDetail })
    );
  }, []);

  return (
    <section className="section pricing" id="pricing" aria-label="Live pricing" ref={sectionRef}>
      <div className="sec-head">
        <h2 className="sec-title">Live pricing · up to 90% off</h2>
        <p className="sec-sub">
          Prices update in real time and move with upstream costs. Each request is billed at the discount in effect when
          it&apos;s made. All prices in USD per 1M tokens.
          <a className="sub-link" href="#live">
            See live discounts
            <Icon name="ic-arrow" />
          </a>
        </p>
      </div>

      <div className="price-featured ai-reveal">
        {featured.map((m) => (
          <article
            className="pf-card ai-lift"
            key={m.name}
            data-vendor={m.vendor}
            data-model={m.name}
            data-live-badge={m.name === liveBadge?.name ? "true" : undefined}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button, a, input")) return;
              jumpToModel(m);
            }}
          >
            <header className="pf-hd">
              <ModelMark model={m} size={22} />
              <span className="pf-tx">
                <b className="pf-name">{m.name}</b>
                <small className="pf-sub">
                  {m.vendor} · {m.ctx} context
                </small>
              </span>
              {m.disc ? (
                <span
                  className="pf-disc is-linkable"
                  role="button"
                  tabIndex={0}
                  aria-label={`See live discount history for ${m.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openInLive(m);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    e.stopPropagation();
                    openInLive(m);
                  }}
                >
                  {m.disc}
                </span>
              ) : null}
            </header>
            <div className="pf-prices">
              <div className="pf-col">
                <span className="pf-cap">Input / 1M tokens</span>
                <span className="pf-off">{m.listIn}</span>
                <b className="pf-now">{m.inNow}</b>
              </div>
              <div className="pf-col">
                <span className="pf-cap">Output / 1M tokens</span>
                <span className="pf-off">{m.listOut}</span>
                <b className="pf-now">{m.outNow}</b>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="price-all" id="priceAll" ref={allRef}>
        <div className="table-tools price-filters">
          <div className="filters pf-chips" role="group" aria-label="Filter models by vendor">
            {filters.map((v) => (
              <button
                key={v}
                className={`filter lf-chip${vendor === v ? " is-active" : ""}`}
                type="button"
                aria-pressed={vendor === v}
                onClick={() => setVendor(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <label className="pf-search" aria-label="Search models">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.2 16.2 4.8 4.8" />
            </svg>
            <input
              type="search"
              id="priceSearch"
              placeholder="Search models"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="table-rel" ref={tableRelRef}>
          <div className="tr-band" aria-hidden="true">
            <span className="tr-sheen" />
          </div>
          <table className="price-table" data-expanded={expanded ? "true" : "false"}>
            <caption className="sr">Live model pricing comparison</caption>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Context</th>
                <th scope="col">Input (List)</th>
                <th scope="col">Output (List)</th>
                <th scope="col" className="tr">
                  Input (VipAI)
                </th>
                <th scope="col" className="tr">
                  Output (VipAI)
                </th>
                <th scope="col">Provider</th>
                <th scope="col">Uptime (SLA)</th>
              </tr>
            </thead>
            <tbody id="priceBody">
              {rows.map((m, i) => (
                <tr
                  key={m.name}
                  data-vendor={m.vendor}
                  data-model={m.name}
                  data-featured={m.featured ? "true" : "false"}
                  className={jumped === m.name ? "is-jumped" : undefined}
                  ref={(el) => {
                    if (el) rowRefs.current.set(m.name, el);
                    else rowRefs.current.delete(m.name);
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a, input")) return;
                    openInLive(m);
                  }}
                  /* Row index drives the stagger of the VipAI column sweep, so
                     the wave stays even however many models are in rotation. */
                  style={{ "--i": i } as CSSProperties}
                >
                  <td>
                    <span className="pt-model">
                      <ModelMark model={m} size={18} />
                      {m.name}
                    </span>
                  </td>
                  <td className="pt-prov">{m.ctx}</td>
                  <td>
                    <span className="pt-off">{m.listIn}</span>
                    <span className="pt-sub">Cache {m.cacheList}</span>
                  </td>
                  <td>
                    <span className="pt-off">{m.listOut}</span>
                  </td>
                  <td className="tr">
                    <span className="pt-now">{m.inNow}</span>
                    {m.disc ? (
                      <span className="disc" style={{ marginLeft: 6 }}>
                        {m.disc}
                      </span>
                    ) : null}
                    <span className="pt-sub">Cache {m.cache}</span>
                  </td>
                  <td className="tr">{m.outNow}</td>
                  <td className="pt-prov">{m.vendor}</td>
                  <td className="pt-prov">—</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="pf-empty" id="priceEmpty">
              No matching models. Try another vendor.
            </p>
          ) : null}
        </div>
      </div>

      <div className="price-toggle-row">
        <button className="lf-chip pt-toggle" id="priceToggle" type="button" aria-expanded={expanded} aria-controls="priceAll" onClick={onToggle}>
          <span className="pt-logos" aria-hidden="true">
            {logoVendors.map((v) => (
              <span className="pl" key={v}>
                <Icon name={brandIcon[v]} style={{ color: brands[v] }} />
              </span>
            ))}
          </span>
          <span className="pt-closed">See all model prices</span>
          <span className="pt-open">Show less</span>
        </button>
      </div>

      <p className="form-note" style={{ marginTop: 14 }}>
        List prices are the providers&apos; published rates; the VipAI column is what you pay. The six cards above are
        our most-used models — open the full catalogue for every model we route.
      </p>
    </section>
  );
}
