"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { PICK_MODEL_EVENT, modelKey, type Model, type PickModelDetail } from "@/lib/data";

/* ---------------------------------------------------------------------------
   Chart geometry, copied from the original module (6298):
     p=48, m=720, f=230, v=52, h=4, g=14, y=8
     y = g + (1 - r / max) * (f - g - y)
   r is `pricePercent` (100 - discount) run through the per-engine axis
   transform, which is why the y-scale is not linear: everything past 20
   (compact) or 30 (c40) is expanded 5x / 3x to keep small discount moves
   visible.
--------------------------------------------------------------------------- */
const CW = 720;
const CH = 230;
const CN = 48;
const CX = 52;
const CG = 14;
const CY = 8;
const CR = 4;

type AxisMode = "linear" | "compact" | "c40";
type Axis = { mode: AxisMode; max: number; ticks: number[] };

const xAt = (i: number) => CX + (i / (CN - 1)) * (CW - CX - CR);

function axisR(mode: AxisMode, p: number) {
  const lim = mode === "linear" ? 100 : 60;
  const n = Math.max(0, Math.min(lim, p));
  if (mode === "linear") return n;
  if (mode === "compact") return n <= 20 ? n : 20 + (n - 20) / 5;
  return n <= 30 ? n : 30 + (n - 30) / 3;
}

const yFor = (mode: AxisMode, max: number, p: number) => CG + (1 - axisR(mode, p) / max) * (CH - CG - CY);

function tickValue(mode: AxisMode, t: number) {
  if (mode === "linear") return t;
  if (mode === "compact") return t <= 20 ? t : 20 + (t - 20) * 5;
  return t <= 30 ? t : 30 + (t - 30) * 3;
}

const smoothSeries = (a: number[]) =>
  a.map((v, i) => {
    if (i === 0) return 0.78 * v + 0.22 * a[1];
    if (i === a.length - 1) return 0.22 * a[i - 1] + 0.78 * v;
    return 0.18 * a[i - 1] + 0.64 * v + 0.18 * a[i + 1];
  });

function smoothPath(pts: Array<[number, number]>) {
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const hourLabel = (i: number, nowHour: number) => {
  const h = (((nowHour - (CN - 1 - i)) % 24) + 24) % 24;
  return (h < 10 ? "0" + h : h) + ":00";
};

const offLabel = (p: number) => Math.round(Math.max(0, 100 - p)) + "% off";

/* The axis is picked from the data the same way the original picks it per
   engine: a wide swing gets the 0-100 linear scale, a mid band gets c40,
   a tight band gets the compact scale. */
function axisFor(raw: number[]): Axis {
  const hi = Math.max(...raw);
  const lo = Math.min(...raw);
  if (hi - lo > 60) return { mode: "linear", max: 100, ticks: [0, 20, 40, 60, 80, 100] };
  if (hi > 30) return { mode: "c40", max: 40, ticks: [0, 10, 20, 30, 40] };
  return { mode: "compact", max: 28, ticks: [0, 10, 20, 28] };
}

function seedOf(name: string) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/* 48 hourly pricePercent points. The price converges into the model's real
   current discount (100 - d) at t=1, so the last point is the number the
   table already shows, and it never has to clamp against 0. Seeded by name,
   so SSR and the client agree and no two models share a shape. */
function historyFor(name: string, discount: number) {
  const s = seedOf(name);
  const now = 100 - discount;
  const span = s < 0.18 ? 62 + s * 40 : 4 + s * 9;
  const a = 1.1 + s * 2.2;
  const b = 0.6 + s * 1.4;
  const amp = 0.35 + s;
  const raw: number[] = [];
  for (let i = 0; i < CN; i++) {
    const t = i / (CN - 1);
    const base = now + span * Math.pow(1 - t, 1.6);
    const ramp = Math.min(1, t * 6);
    const wobble = (Math.sin(i / a + b) * amp + Math.sin(i / (a * 0.31)) * 0.22) * ramp;
    raw.push(Math.max(1, Math.min(100, base + wobble)));
  }
  raw[CN - 1] = now;
  return raw;
}

export function LiveDiscounts({ models }: { models: Model[] }) {
  const [vendor, setVendor] = useState<string>("Featured");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [nowHour, setNowHour] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);

  const pxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const guideRef = useRef<SVGLineElement | null>(null);
  const dotRef = useRef<SVGLineElement | null>(null);
  const haloRef = useRef<SVGLineElement | null>(null);
  const endRef = useRef<SVGLineElement | null>(null);

  useEffect(() => {
    setNowHour(new Date().getHours());
    const onResize = () => setNarrow(window.innerWidth < 720);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Only a model that carries a discount can be charted, and it renders the
  // same live number the pricing table shows.
  const discounted = useMemo(
    () => models.filter((m) => m.discPct > 0).map((m) => ({ n: m.name, v: m.vendor, d: m.discPct, icon: m.vendorIcon })),
    [models]
  );
  const filters = useMemo(() => ["Featured", ...new Set(discounted.map((m) => m.v))], [discounted]);

  const rows = useMemo(() => {
    const base = vendor === "Featured" ? discounted : discounted.filter((m) => m.v === vendor);
    const q = query.trim().toLowerCase();
    return q ? base.filter((m) => m.n.toLowerCase().includes(q)) : base;
  }, [vendor, query, discounted]);

  useEffect(() => {
    if (!rows.length) return;
    if (!active || !rows.some((m) => m.n === active)) setActive(rows[0].n);
  }, [rows, active]);

  // The pricing table asks for the same model to be selected here. If the pill
  // is filtered out, switch the vendor first, then select and scroll.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<PickModelDetail>).detail;
      if (!detail) return;
      const target = discounted.find((m) => modelKey(m.n) === detail.key);
      if (!target) return;
      setVendor((cur) => (rows.some((m) => m.n === target.n) ? cur : filters.includes(target.v) ? target.v : cur));
      setActive(target.n);
      const raf = requestAnimationFrame(() => {
        document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return () => cancelAnimationFrame(raf);
    };
    document.addEventListener(PICK_MODEL_EVENT, onPick);
    return () => document.removeEventListener(PICK_MODEL_EVENT, onPick);
  }, [rows, discounted, filters]);

  const histories = useMemo(() => {
    const map = new Map<string, { raw: number[]; axis: Axis }>();
    discounted.forEach((m) => {
      const raw = historyFor(m.n, m.d);
      map.set(m.n, { raw, axis: axisFor(raw) });
    });
    return map;
  }, [discounted]);

  const hist = active ? histories.get(active) : undefined;
  const mode = hist ? hist.axis.mode : "compact";
  const max = hist ? hist.axis.max : 28;
  const plot = useMemo(() => (hist ? smoothSeries(hist.raw) : null), [hist]);
  const bottom = (CH - CY).toFixed(1);

  const line = useMemo(() => {
    if (!plot) return "";
    return smoothPath(plot.map((v, i) => [xAt(i), yFor(mode, max, v)] as [number, number]));
  }, [plot, mode, max]);

  const avgY = hist ? yFor(mode, max, hist.raw.reduce((a, b) => a + b, 0) / CN).toFixed(1) : "";
  const last = plot ? ([xAt(CN - 1), yFor(mode, max, plot[CN - 1])] as [number, number]) : null;

  const metrics = useMemo<Array<[string, string]>>(() => {
    if (!hist) return [["NOW", "—"], ["AVG", "—"], ["BEST", "—"], ["NET INPUT", "—"], ["NET OUTPUT", "—"], ["NET CACHE", "—"]];
    const mean = hist.raw.reduce((a, b) => a + b, 0) / CN;
    const best = Math.min(...hist.raw);
    const off = (p: number) => `${Math.round(Math.max(0, 100 - p))}%`;
    const avgOff = Math.max(0, 100 - mean);
    return [
      ["NOW", off(hist.raw[CN - 1])],
      ["AVG", off(mean)],
      ["BEST", off(best)],
      ["NET INPUT", `−${(avgOff * 0.9).toFixed(1)}%`],
      ["NET OUTPUT", `−${(avgOff * 0.86).toFixed(1)}%`],
      ["NET CACHE", `−${(avgOff * 0.95).toFixed(1)}%`],
    ];
  }, [hist]);

  // Scrub is armed on pointerdown, not hover, exactly like the source.
  useEffect(() => {
    const px = pxRef.current;
    const svg = svgRef.current;
    const tip = tipRef.current;
    if (!px || !svg || !tip || !plot) return;
    let dragging = false;

    const reset = () => {
      tip.style.opacity = "0";
      guideRef.current?.setAttribute("opacity", "0");
      dotRef.current?.setAttribute("opacity", "0");
      haloRef.current?.setAttribute("opacity", "0");
      endRef.current?.setAttribute("opacity", "1");
    };

    const scrub = (ev: PointerEvent) => {
      const pr = px.getBoundingClientRect();
      const sr = svg.getBoundingClientRect();
      if (!sr.width || !sr.height) return;
      const clamped = Math.max(CX, Math.min(CW - CR, ((ev.clientX - sr.left) / sr.width) * CW));
      const i = Math.min(CN - 1, Math.round(((clamped - CX) / (CW - CX - CR)) * (CN - 1)));
      const x = xAt(i);
      const y = yFor(mode, max, plot[i]);
      const g = guideRef.current;
      if (g) {
        g.setAttribute("x1", String(x));
        g.setAttribute("x2", String(x));
        g.setAttribute("opacity", "1");
      }
      [haloRef.current, dotRef.current].forEach((el) => {
        if (el) {
          el.setAttribute("x1", String(x));
          el.setAttribute("y1", String(y));
          el.setAttribute("x2", String(x));
          el.setAttribute("y2", String(y));
          el.setAttribute("opacity", "1");
        }
      });
      endRef.current?.setAttribute("opacity", "0");
      tip.textContent = hourLabel(i, nowHour ?? new Date().getHours()) + " · " + offLabel(hist!.raw[i]);
      tip.style.opacity = "1";
      const lx = sr.left - pr.left + (x / CW) * sr.width;
      const ly = sr.top - pr.top + (y / CH) * sr.height;
      const left = Math.max(tip.offsetWidth / 2 + 8, Math.min(pr.width - tip.offsetWidth / 2 - 8, lx));
      const above = ly < tip.offsetHeight + 14;
      tip.style.left = `${left}px`;
      tip.style.top = `${above ? ly + 12 : ly - tip.offsetHeight - 12}px`;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") {
        dragging = true;
        try {
          px.setPointerCapture(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
      }
      scrub(e);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || dragging) scrub(e);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (e.pointerType !== "mouse") reset();
    };
    const onCancel = () => {
      dragging = false;
      reset();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") reset();
    };

    px.addEventListener("pointerdown", onDown);
    px.addEventListener("pointermove", onMove);
    px.addEventListener("pointerup", onUp);
    px.addEventListener("pointercancel", onCancel);
    px.addEventListener("pointerleave", onLeave);
    reset();
    return () => {
      px.removeEventListener("pointerdown", onDown);
      px.removeEventListener("pointermove", onMove);
      px.removeEventListener("pointerup", onUp);
      px.removeEventListener("pointercancel", onCancel);
      px.removeEventListener("pointerleave", onLeave);
    };
  }, [plot, mode, max, hist, nowHour]);

  const narrowIdx = narrow ? [0, 12, 24, 36] : [0, 6, 12, 18, 24, 30, 36, 42];

  return (
    <section className="section" id="live" aria-label="Live discounts" style={{ paddingTop: 0 }}>
      <div className="sec-head">
        <h2 className="sec-title">
          Live discounts
          <span className="live-badge">
            <i aria-hidden="true" />
            Demo dataset
          </span>
        </h2>
        <p className="sec-sub">
          Discounts are repriced every hour as upstream costs move. Each request is billed at the discount in effect when
          it&apos;s made.
        </p>
      </div>

      <div className="live-controls">
        <div className="filters live-filters" role="group" aria-label="Filter discounts by vendor">
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
        <label className="live-search" aria-label="Search discounts">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.2 16.2 4.8 4.8" />
          </svg>
          <input
            type="search"
            id="liveSearch"
            placeholder="Search models"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="live-panel">
        <div className="live-models" role="listbox" aria-label="Models">
          {rows.map((m) => (
            <button
              key={m.n}
              data-v={m.v}
              className={`lm-pill ai-lift${active === m.n ? " is-on" : ""}`}
              type="button"
              role="option"
              aria-selected={active === m.n}
              onClick={() => setActive(m.n)}
            >
              {/* Colour comes from the stylesheet via [data-v] so the selected
                  row can re-tint the mark for the dark fill. */}
              <Icon name={m.icon} className="lg" />
              <span className="nm">{m.n}</span>
              <span className="disc">−{m.d}%</span>
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="live-empty">
            <b>No models match</b>
            <span>Try another vendor or clear the search.</span>
          </p>
        ) : null}
        <div className="live-chart">
          <div className="lc2-stats">
            {metrics.map(([k, v]) => (
              <div className="lc2-stat" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <div className="lc2-px" ref={pxRef}>
            <svg
              ref={svgRef}
              className="chart-svg"
              viewBox={`0 0 ${CW} ${CH}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={active ? `Discount history for ${active}, hourly over 48 hours` : "No model selected"}
            >
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f97316" stopOpacity=".28" />
                  <stop offset="1" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
              </defs>
              {!hist ? (
                <text x={CW / 2} y={CH / 2} textAnchor="middle" fill="currentColor" fontSize="16">
                  No discount history yet
                </text>
              ) : (
                <>
                  {hist.axis.ticks.map((t) => {
                    const y = yFor(mode, max, tickValue(mode, t));
                    return (
                      <line
                        key={t}
                        x1={CX}
                        x2={CW - CR}
                        y1={y.toFixed(1)}
                        y2={y.toFixed(1)}
                        stroke="rgba(20,17,15,.14)"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  <line
                    x1={CX}
                    x2={CW - CR}
                    y1={avgY}
                    y2={avgY}
                    stroke="#14110f"
                    strokeOpacity=".3"
                    strokeWidth="1"
                    strokeDasharray="4 5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={`${line} L ${last![0].toFixed(1)} ${bottom} L ${xAt(0).toFixed(1)} ${bottom} Z`}
                    fill="url(#cg)"
                  />
                  <path
                    d={line}
                    fill="none"
                    stroke="#c2410c"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    ref={guideRef}
                    className="ln-guide"
                    y1={CG}
                    y2={bottom}
                    stroke="rgba(20,17,15,.22)"
                    strokeWidth="1"
                    opacity="0"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    ref={endRef}
                    className="ln-end"
                    x1={last![0].toFixed(1)}
                    y1={last![1].toFixed(1)}
                    x2={last![0].toFixed(1)}
                    y2={last![1].toFixed(1)}
                    stroke="#c2410c"
                    strokeWidth="6.4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    ref={haloRef}
                    className="ln-dot-halo"
                    stroke="#fffefb"
                    strokeWidth="8.8"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    opacity="0"
                  />
                  <line
                    ref={dotRef}
                    className="ln-dot"
                    stroke="#c2410c"
                    strokeWidth="5.6"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    opacity="0"
                  />
                </>
              )}
            </svg>
            {hist ? (
              <div className="lc2-y-axis" aria-hidden="true">
                {hist.axis.ticks.map((t) => {
                  const tv = tickValue(mode, t);
                  return (
                    <span
                      key={t}
                      className={tv === 10 || tv === 20 ? "is-emphasis" : undefined}
                      style={{ top: `${((yFor(mode, max, tv) / CH) * 100).toFixed(2)}%` }}
                    >
                      {Math.round(Math.max(0, 100 - tv))}%
                    </span>
                  );
                })}
              </div>
            ) : null}
            <span className="lc2-tip" ref={tipRef} />
          </div>
          <div className="lc2-axis" aria-hidden="true">
            {hist && nowHour !== null
              ? narrowIdx.map((i) => (
                  <span key={i} style={{ left: `${((xAt(i) / CW) * 100).toFixed(4)}%` }}>
                    {hourLabel(i, nowHour)}
                  </span>
                ))
              : null}
          </div>
          <p className="lc2-note">48 hours · hourly · dashed = average</p>
        </div>
      </div>
    </section>
  );
}
