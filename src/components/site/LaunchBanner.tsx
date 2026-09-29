"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { usePrefsStore } from "@/lib/prefs-store";

type BannerMessage = { text: string; href: string; icon: ReactNode };

const messages: BannerMessage[] = [
  {
    text: "Free test tokens — try any model",
    href: "#telegram",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 4.5 13H11l-1 9 8.5-11H12z" />
      </svg>
    ),
  },
  {
    text: "Real models, never fake",
    href: "#faq",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.2 19 6v5.8c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z" />
        <polyline points="9.2 12.2 11.2 14.2 15 9.6" />
      </svg>
    ),
  },
  {
    text: "Fake found? Refund + 10× back",
    href: "#faq",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
        <polyline points="3.5 3.5 3.5 8.5 8.5 8.5" />
        <path d="M12 8.5v7M9.8 10.2h3.6a1.5 1.5 0 0 1 0 3h-2.8a1.5 1.5 0 0 0 0 3h3.6" />
      </svg>
    ),
  },
];

const ROTATE_MS = 4500;

/** Length of the dismissal burn. Must match `.lb-burn-out` in overrides.css. */
const EXIT_MS = 850;

/** Same local calendar day. A dismissal only covers the day it was made, so the
 *  banner is back after midnight instead of staying gone for a week. */
function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function LaunchBanner() {
  const dismissedAt = usePrefsStore((state) => state.launchBannerDismissedAt);
  const dismissBanner = usePrefsStore((state) => state.dismissLaunchBanner);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const fuseRef = useRef<HTMLCanvasElement | null>(null);
  /** Lights the ember layer. Set up by the effect below, called again on exit. */
  const relight = useRef<(() => void) | null>(null);
  const exitTimer = useRef<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(0);

  // Read the persisted dismissal after mount so server and client agree.
  useEffect(() => {
    void usePrefsStore.persist.rehydrate();
  }, []);

  // Auto-hide once the page is scrolled past the banner. Unlike a dismissal this
  // keeps the reserved space (--lb-space), so nothing shifts; only --lb-h moves,
  // which slides the nav up and re-aligns the sticky pricing filters/header.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dismissedToday = dismissedAt !== null && isSameLocalDay(dismissedAt, Date.now());

  // Honour a dismissal from earlier the same day, mirroring the
  // static build's `launch-banner-off` root class.
  useEffect(() => {
    if (dismissedToday) {
      setHidden(true);
      document.documentElement.classList.add("launch-banner-off");
    }
  }, [dismissedToday]);

  useEffect(() => {
    const lifted = hidden || scrolled;
    document.documentElement.classList.toggle("lb-scrolled", scrolled);
    document.documentElement.style.setProperty("--lb-h", lifted ? "0px" : "44px");
    document.documentElement.style.setProperty("--lb-space", hidden ? "0px" : "44px");
  }, [hidden, scrolled]);

  useEffect(() => {
    if (hidden || exiting) return;
    const id = window.setInterval(() => setActive((v) => (v + 1) % messages.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [hidden, exiting]);

  /* Ember layer for both burns. It lives here rather than with the ambient
     canvases in SiteMotion because the dismissal has to re-light it: the loop
     is one shot per ignition and retires at the right edge, so `relight` starts
     a fresh front when the close button is pressed. `--lb-burn` is the CSS
     animation's front position, read back each frame, which is what welds the
     fire to the mask edge instead of merely paralleling it. */
  useEffect(() => {
    const banner = bannerRef.current;
    const canvas = fuseRef.current;
    if (!banner || !canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const TAU = Math.PI * 2;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    type Ember = { x: number; y: number; vx: number; vy: number; life: number; ttl: number; r: number };
    let embers: Ember[] = [];
    let w = 1;
    let h = 1;
    let raf = 0;
    let last = 0;
    let elapsed = 0;

    /* The fuse runs along the bottom edge of the strip. The glow is stretched
       vertically so the heat reaches up over the copy the flame is passing. */
    const fuseY = () => Math.max(0, h - 3);

    const resize = () => {
      const rect = banner.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * d);
      canvas.height = Math.floor(h * d);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };

    /* Front position as a percentage of the banner width. Falls back to
       "already finished" when the property is missing, so a load with the
       animation disabled draws nothing at all. */
    const front = () => {
      const raw = getComputedStyle(banner).getPropertyValue("--lb-burn").trim();
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : 114;
    };

    const draw = (ts: number) => {
      raf = 0;
      const dt = last ? Math.min(48, ts - last) : 16;
      last = ts;
      elapsed += dt;
      ctx.clearRect(0, 0, w, h);
      const x = (front() / 100) * w;
      const fy = fuseY();
      const live = x > -40 && x < w + 40;

      /* The unburnt fuse, drawn from the very first frame so the banner
         arrives — and leaves — with its fuse strung across it. */
      if (x < w) {
        ctx.save();
        ctx.setLineDash([2, 6]);
        ctx.strokeStyle = "rgba(252,252,251,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x + 4), fy);
        ctx.lineTo(w, fy);
        ctx.stroke();
        ctx.restore();
      }

      /* Trail: white-hot at the head, cooling into the dark behind it. */
      if (live && x > 1) {
        const start = x - Math.min(x, 96);
        const g = ctx.createLinearGradient(start, 0, x, 0);
        g.addColorStop(0, "rgba(150,32,0,0)");
        g.addColorStop(0.5, "rgba(203,68,12,0.34)");
        g.addColorStop(1, "rgba(255,198,112,0.9)");
        ctx.strokeStyle = g;
        ctx.lineCap = "round";
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(start, fy);
        ctx.lineTo(x, fy);
        ctx.stroke();
      }

      /* Sparks thrown back and up off the head; gravity takes them from there.
         Capped so a long frame cannot flood the canvas. */
      if (live && embers.length < 260) {
        const born = Math.random() < 0.85 ? 1 + Math.round(Math.random() * 2) : 0;
        for (let i = 0; i < born; i++) {
          embers.push({
            x: x + rand(-2, 2),
            y: fy + rand(-2, 2),
            vx: rand(-0.34, 0.06),
            vy: rand(-0.5, -0.06),
            life: 0,
            ttl: rand(280, 720),
            r: rand(0.6, 1.7),
          });
        }
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life += dt;
        if (e.life >= e.ttl) {
          embers.splice(i, 1);
          continue;
        }
        e.vy += 0.00062 * dt;
        e.vx *= 1 - 0.0018 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const k = 1 - e.life / e.ttl;
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.fillStyle = k > 0.6 ? "#fff1cc" : k > 0.28 ? "#ffab4f" : "#ff5b1c";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (0.3 + 0.7 * k), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* The ember head: a flickering core under an elliptical glow tall enough
         to lick the copy as the mask opens or closes behind it. */
      if (live) {
        const flick = 0.86 + 0.14 * Math.sin(ts / 41) * Math.sin(ts / 13);
        const r = 30 * flick;
        ctx.save();
        ctx.translate(x, fy);
        ctx.scale(1, 1.7);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        glow.addColorStop(0, "rgba(255,246,220,0.95)");
        glow.addColorStop(0.22, "rgba(255,180,70,0.58)");
        glow.addColorStop(0.6, "rgba(226,74,10,0.2)");
        glow.addColorStop(1, "rgba(226,74,10,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fffdf6";
        ctx.beginPath();
        ctx.arc(x, fy, 1.9, 0, TAU);
        ctx.fill();
      }

      /* Retire once the front is past the edge and nothing still burns. */
      if ((x > w + 20 || elapsed > 2600) && embers.length === 0) return;
      raf = requestAnimationFrame(draw);
    };

    const relightBurn = () => {
      last = 0;
      elapsed = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    relight.current = relightBurn;

    resize();
    relightBurn();
    window.addEventListener("resize", resize);
    return () => {
      relight.current = null;
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      embers = [];
    };
  }, []);

  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    []
  );

  const finishExit = useCallback(() => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    dismissBanner(Date.now());
    document.documentElement.classList.add("launch-banner-off");
    setHidden(true);
  }, [dismissBanner]);

  /* Dismissal. The banner is burnt off rather than snapped away: the fuse is
     lit again and eats the whole strip (see `.is-exiting` in overrides.css)
     while the ember layer rides the same front. The space it held is only
     released at the end, so the nav does not jump up under the flame. */
  const beginExit = useCallback(() => {
    if (exiting || hidden) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finishExit();
      return;
    }
    setExiting(true);
    relight.current?.();
    exitTimer.current = window.setTimeout(finishExit, EXIT_MS);
  }, [exiting, hidden, finishExit]);

  if (hidden) return null;

  return (
    <div
      ref={bannerRef}
      className={`launch-banner is-stars is-entering${exiting ? " is-exiting" : ""}`}
      id="launchBanner"
    >
      <canvas className="lb-stars" aria-hidden="true" />
      <canvas className="lb-fuse" ref={fuseRef} aria-hidden="true" />
      <a className="launch-banner-link" href={messages[active].href}>
        <span className="launch-banner-text">
          {messages.map((m, i) => (
            <span
              key={m.text}
              className={`lb-msg${i === active ? " is-on" : ""}`}
              aria-hidden={i !== active}
            >
              {m.icon}
              {m.text}
            </span>
          ))}
        </span>
        <Icon name="ic-arrow" width={16} height={16} className="launch-banner-arrow" />
      </a>
      <button
        type="button"
        className="launch-banner-close"
        aria-label="Dismiss announcement"
        onClick={beginExit}
      >
        <Icon name="ic-x" width={15} height={15} />
      </button>
    </div>
  );
}
