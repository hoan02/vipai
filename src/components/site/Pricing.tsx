"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/lib/icons";
import { PICK_MODEL_EVENT, brandMark, modelKey, type Model, type PickModelDetail } from "@/lib/data";

/** The filter value for "no vendor filter". A stable value, not a label: the
 *  chips compare against it, so it must not change with the locale. */
const FEATURED = "Featured";

function ModelMark({ model, size }: { model: Model; size: number }) {
  return (
    <Icon name={model.vendorIcon} width={size} height={size} className="lg" style={{ color: model.vendorColor }} />
  );
}

type VendorChip = { name: string; icon: string; color: string };

/** "Featured" plus every vendor the gateway currently prices, each with the
 *  mark of one of its models, so the filters follow the catalogue. */
function vendorChips(models: Model[]): VendorChip[] {
  const seen = new Map<string, VendorChip>();
  for (const m of models) {
    if (!seen.has(m.vendor)) seen.set(m.vendor, { name: m.vendor, icon: m.vendorIcon, color: m.vendorColor });
  }
  return [{ name: FEATURED, icon: brandMark, color: "var(--ink)" }, ...seen.values()];
}

const EXPAND_MS = 620;
const COLLAPSE_MS = 440;
/** the source waits out the expand tween before it can measure the row */
const JUMP_AFTER_EXPAND_MS = 660;
const JUMP_FLASH_MS = 1800;

export function Pricing({ models, liveHref = "#live" }: { models: Model[]; liveHref?: string | null }) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const [vendor, setVendor] = useState<string>(FEATURED);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [jumped, setJumped] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const allRef = useRef<HTMLDivElement | null>(null);
  const animating = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const chips = useMemo(() => vendorChips(models), [models]);
  const logoVendors = useMemo(() => chips.filter((c) => c.name !== "Featured"), [chips]);

  const featured = useMemo(() => models.filter((m) => m.featured), [models]);

  const liveBadge = useMemo(
    () => featured.reduce<Model | null>((best, m) => (!best || m.discPct > best.discPct ? m : best), null),
    [featured]
  );

  // The headline claim follows the catalogue instead of a hand-typed number, so
  // it can never promise a discount the gateway does not actually bill. The
  // `{n}` lets the i18n pass translate it with the live figure.
  const maxOff = useMemo(() => models.reduce((max, m) => Math.max(max, m.discPct), 0), [models]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = vendor === FEATURED ? models : models.filter((m) => m.vendor === vendor);
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
      // Top of the band is the bottom of the header row. Measured through
      // offsetTop rather than getBoundingClientRect: the header is sticky, so
      // its rect follows the scroll and would drag the band up over the
      // column titles whenever the table is scrolled.
      const thead = tableRel.querySelector("thead");
      const table = tableRel.querySelector("table");
      if (thead && table) {
        const headerBottom = table.offsetTop + thead.offsetTop + thead.offsetHeight;
        tableRel.style.setProperty("--tr-band-top", `${Math.round(headerBottom)}px`);
        // Mirror for the lower edge. .table-rel is padded, so its own bottom
        // sits below the last row; without this the wash overhangs the table.
        const tableBottom = tableRel.clientHeight - (table.offsetTop + table.offsetHeight);
        tableRel.style.setProperty("--tr-band-bottom", `${Math.round(Math.max(0, tableBottom))}px`);
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
      if (vendor !== m.vendor) setVendor(m.vendor);
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
    <section className="section pricing" id="pricing" aria-label={t("label")} ref={sectionRef} data-i18n-skip>
      <div className="sec-head">
        <h2 className="sec-title">{maxOff > 0 ? t("titleDiscounted", { n: maxOff }) : t("title")}</h2>
        <p className="sec-sub">
          {t("subtitle")}
          {liveHref ? (
            <a className="sub-link" href={liveHref}>
              {t("seeLiveDiscounts")}
              <Icon name="ic-arrow" />
            </a>
          ) : null}
        </p>
      </div>

      <div className="price-featured ai-reveal">
        {featured.map((m) => (
          <article
            className="pf-card ai-lift"
            key={m.id}
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
                  {m.ctx ? t("cardContext", { vendor: m.vendor, ctx: m.ctx }) : m.vendor}
                </small>
              </span>
              {m.discPct > 0 ? (
                <span
                  className="pf-disc is-linkable"
                  role="button"
                  tabIndex={0}
                  aria-label={t("discountHistoryLabel", { model: m.name })}
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
                  {tc("discountOff", { pct: m.discPct })}
                </span>
              ) : null}
            </header>
            <div className="pf-prices">
              <div className="pf-col">
                <span className="pf-cap">{t("inputPerMillion")}</span>
                <span className="pf-off">{m.listIn}</span>
                <b className="pf-now">{m.inNow}</b>
              </div>
              <div className="pf-col">
                <span className="pf-cap">{t("outputPerMillion")}</span>
                <span className="pf-off">{m.listOut}</span>
                <b className="pf-now">{m.outNow}</b>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="price-all" id="priceAll" ref={allRef}>
        <div className="table-tools price-filters">
          <div className="filters pf-chips" role="group" aria-label={t("filterLabel")}>
            {chips.map((c) => (
              <button
                key={c.name}
                className={`filter lf-chip${vendor === c.name ? " is-active" : ""}`}
                type="button"
                aria-pressed={vendor === c.name}
                onClick={() => setVendor(c.name)}
              >
                {c.name === FEATURED ? t("featured") : c.name}
              </button>
            ))}
          </div>
          <label className="pf-search" aria-label={t("searchLabel")}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.2 16.2 4.8 4.8" />
            </svg>
            <input
              type="search"
              id="priceSearch"
              placeholder={t("searchPlaceholder")}
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
            <caption className="sr">{t("tableCaption")}</caption>
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
                <th scope="col">{t("colModel")}</th>
                <th scope="col">{t("colContext")}</th>
                <th scope="col">{t("colListInput")}</th>
                <th scope="col">{t("colListOutput")}</th>
                <th scope="col" className="tr">
                  {t("colVipaiInput")}
                </th>
                <th scope="col" className="tr">
                  {t("colVipaiOutput")}
                </th>
                <th scope="col">{t("colCache")}</th>
                <th scope="col">{t("colProvider")}</th>
              </tr>
            </thead>
            <tbody id="priceBody">
              {rows.map((m, i) => (
                <tr
                  key={m.id}
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
                  <td className="pt-prov">{m.ctx ?? "—"}</td>
                  <td>{m.listIn ? <span className="pt-off">{m.listIn}</span> : "—"}</td>
                  <td>{m.listOut ? <span className="pt-off">{m.listOut}</span> : "—"}</td>
                  <td className="tr">
                    <span className="pt-now">{m.inNow}</span>
                    {m.discPct > 0 ? (
                      <span className="disc" style={{ marginLeft: 6 }}>
                        {tc("discountOff", { pct: m.discPct })}
                      </span>
                    ) : null}
                  </td>
                  <td className="tr">{m.outNow}</td>
                  <td className="pt-prov">{m.cache}</td>
                  <td className="pt-prov">{m.vendor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {models.length === 0 ? (
            <p className="pf-empty" id="priceEmpty">
              {t("emptyUnavailable")}
            </p>
          ) : rows.length === 0 ? (
            <p className="pf-empty" id="priceEmpty">
              {t("emptyNoMatch")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="price-toggle-row">
        <button className="lf-chip pt-toggle" id="priceToggle" type="button" aria-expanded={expanded} aria-controls="priceAll" onClick={onToggle}>
          <span className="pt-logos" aria-hidden="true">
            {logoVendors.map((c) => (
              <span className="pl" key={c.name}>
                <Icon name={c.icon} style={{ color: c.color }} />
              </span>
            ))}
          </span>
          <span className="pt-closed">{t("seeAll")}</span>
          <span className="pt-open">{t("showLess")}</span>
        </button>
      </div>

      <p className="form-note" style={{ marginTop: 14 }}>
        {t("note")}
      </p>
    </section>
  );
}
