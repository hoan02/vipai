"use client";

import { useEffect } from "react";

/**
 * Mounts the four canvas/CSS motion layers once, mirroring the static build:
 * scroll reveal, launch-banner star field, hero ASCII lens, cursor spotlight
 * and the pixel route canvas. Everything is a no-op under reduced motion.
 */
export function SiteMotion() {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    const cleanups: Array<() => void> = [];

    /* ---------- Scroll reveal ----------
       The source drives this from one selector group, not a per-element
       attribute: threshold .12, a rootBounds fallback for tall targets, and a
       re-sweep on load and again after 1.2s for anything already above 92vh. */
    const root = document.documentElement;

    /* Colours for the canvases below. Canvas 2D cannot resolve var() or
       color-mix(), so the ink token is read once and re-read whenever the
       theme attribute changes. */
    const readInk = () => {
      const raw = getComputedStyle(root).getPropertyValue("--ink").trim() || "#14110f";
      const match = /^#?([0-9a-f]{6})$/i.exec(raw);
      const value = match ? Number.parseInt(match[1], 16) : 0x14110f;
      return { hex: raw, rgb: `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}` };
    };
    let ink = readInk();
    const themeObserver = new MutationObserver(() => {
      ink = readInk();
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    cleanups.push(() => themeObserver.disconnect());

    const REVEAL_SELECTOR = [
      "#pricing .sec-head",
      ".price-featured > .pf-card",
      ".price-toggle-row",
      "#live .sec-head",
      "#live .live-controls",
      "#live .live-panel",
      "#stats",
      "#buyhook",
      "#features",
      "#why",
      "#routing",
      "#ranking",
      "#buy",
      "#finale",
      "#quickstart",
      "#faq",
      "#telegram",
    ].join(",");
    const revealList = () => Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
    if (!reduce) {
      if (!("IntersectionObserver" in window)) {
        revealList().forEach((el) => el.classList.add("is-in"));
      } else {
        root.classList.add("reveal-on");
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              const below = e.rootBounds && e.boundingClientRect.top < e.rootBounds.bottom;
              if (e.isIntersecting || below) {
                e.target.classList.add("is-in");
                io.unobserve(e.target);
              }
            });
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
        );
        const sweep = () => {
          revealList().forEach((el) => {
            if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < 0.92 * window.innerHeight) {
              el.classList.add("is-in");
              io.unobserve(el);
            }
          });
        };
        revealList().forEach((el) => io.observe(el));
        window.addEventListener("load", sweep);
        const sweepTimer = window.setTimeout(sweep, 1200);
        cleanups.push(() => {
          io.disconnect();
          window.removeEventListener("load", sweep);
          window.clearTimeout(sweepTimer);
        });
      }
    }

    if (reduce) return () => cleanups.forEach((c) => c());

    /* ---------- Cursor spotlight glow ---------- */
    const hero = document.querySelector<HTMLElement>(".hero-wrap");
    const glow = hero?.querySelector<HTMLElement>(".hero-glow");
    if (hero && glow) {
      let gx = 0;
      let gy = 0;
      let tx = 0;
      let ty = 0;
      let raf = 0;
      const tick = () => {
        gx += (tx - gx) * 0.12;
        gy += (ty - gy) * 0.12;
        glow.style.setProperty("--mx", `${gx.toFixed(1)}px`);
        glow.style.setProperty("--my", `${gy.toFixed(1)}px`);
        raf = Math.abs(tx - gx) > 0.4 || Math.abs(ty - gy) > 0.4 ? requestAnimationFrame(tick) : 0;
      };
      const onMove = (e: PointerEvent) => {
        const r = hero.getBoundingClientRect();
        tx = e.clientX - r.left;
        ty = e.clientY - r.top;
        glow.classList.add("on");
        if (!raf) raf = requestAnimationFrame(tick);
      };
      const onLeave = () => glow.classList.remove("on");
      hero.addEventListener("pointermove", onMove, { passive: true });
      hero.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        hero.removeEventListener("pointermove", onMove);
        hero.removeEventListener("pointerleave", onLeave);
        cancelAnimationFrame(raf);
      });
    }

    /* ---------- Launch banner star field ---------- */
    const banner = document.getElementById("launchBanner");
    const starCvs = banner?.querySelector<HTMLCanvasElement>(".lb-stars");
    if (banner && starCvs) {
      const ctx = starCvs.getContext("2d")!;
      let w = 1;
      let h = 1;
      let stars: Array<{ x: number; y: number; r: number; s: number; p: number }> = [];
      let raf = 0;
      let last = 0;
      let visible = true;
      const resize = () => {
        const r = banner.getBoundingClientRect();
        w = Math.max(1, r.width);
        h = Math.max(1, r.height);
        const d = dpr();
        starCvs.width = Math.floor(w * d);
        starCvs.height = Math.floor(h * d);
        starCvs.style.width = `${w}px`;
        starCvs.style.height = `${h}px`;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const n = Math.round(w / 12);
        stars = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.1 + 0.35,
          s: Math.random() * 0.14 + 0.03,
          p: Math.random() * Math.PI * 2,
        }));
      };
      const draw = (ts: number) => {
        const dt = last ? Math.min(48, ts - last) : 16;
        last = ts;
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) {
          s.x -= (s.s * dt) / 16;
          if (s.x < -2) {
            s.x = w + 2;
            s.y = Math.random() * h;
          }
          ctx.globalAlpha = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(ts / 900 + s.p));
          ctx.fillStyle = "#fffefb";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        raf = visible ? requestAnimationFrame(draw) : 0;
      };
      const onResize = () => resize();
      const onVis = () => {
        visible = !document.hidden;
        last = 0;
        if (visible && !raf) raf = requestAnimationFrame(draw);
      };
      resize();
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame(draw);
      cleanups.push(() => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        cancelAnimationFrame(raf);
      });
    }

    /* ---------- Hero ASCII lens ---------- */
    const asciiCvs = hero?.querySelector<HTMLCanvasElement>(".hero-ascii");
    if (hero && asciiCvs) {
      const ctx = asciiCvs.getContext("2d")!;
      const CELL = 13;
      const R = 150;
      const RAMP = " .:-=+*#%@";
      let w = 1;
      let h = 1;
      let cols = 0;
      let rows = 0;
      let raf = 0;
      let ready = false;
      let drum: Float32Array | null = null;
      const cursor = { x: -9999, y: -9999 };
      const off = document.createElement("canvas");
      const octx = off.getContext("2d")!;
      const img = new Image();
      const sample = () => {
        if (!cols || !img.complete) return;
        off.width = cols;
        off.height = rows;
        try {
          octx.drawImage(img, 0, 0, cols, rows);
          const data = octx.getImageData(0, 0, cols, rows).data;
          drum = new Float32Array(cols * rows);
          for (let i = 0; i < cols * rows; i++) {
            const o = i * 4;
            drum[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
          }
          ready = true;
        } catch {
          ready = false;
        }
      };
      img.onload = sample;
      img.src = "/assets/hero-art-bg.webp";
      const resize = () => {
        const r = hero.getBoundingClientRect();
        w = Math.max(1, r.width);
        h = Math.max(1, r.height);
        const d = dpr();
        asciiCvs.width = Math.floor(w * d);
        asciiCvs.height = Math.floor(h * d);
        asciiCvs.style.width = `${w}px`;
        asciiCvs.style.height = `${h}px`;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        cols = Math.ceil(w / CELL);
        rows = Math.ceil(h / CELL);
        if (img.complete) sample();
      };
      const render = () => {
        raf = 0;
        ctx.clearRect(0, 0, w, h);
        if (!ready || !drum) return;
        const minC = Math.max(0, Math.floor((cursor.x - R) / CELL));
        const maxC = Math.min(cols - 1, Math.ceil((cursor.x + R) / CELL));
        const minR = Math.max(0, Math.floor((cursor.y - R) / CELL));
        const maxR = Math.min(rows - 1, Math.ceil((cursor.y + R) / CELL));
        ctx.font = `${CELL}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const cx = c * CELL + CELL / 2;
            const cy = r * CELL + CELL / 2;
            const dx = cx - cursor.x;
            const dy = cy - cursor.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > R * R) continue;
            const fall = 1 - Math.sqrt(d2) / R;
            const lum = drum[r * cols + c];
            const ch = RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(lum * (RAMP.length - 1))))];
            ctx.globalAlpha = fall * 0.5;
            ctx.fillStyle = ink.hex;
            ctx.fillText(ch, cx, cy);
          }
        }
        ctx.globalAlpha = 1;
      };
      const onMove = (e: PointerEvent) => {
        const r = hero.getBoundingClientRect();
        cursor.x = e.clientX - r.left;
        cursor.y = e.clientY - r.top;
        if (!raf) raf = requestAnimationFrame(render);
      };
      const onLeave = () => {
        cursor.x = -9999;
        cursor.y = -9999;
        ctx.clearRect(0, 0, w, h);
      };
      const onResize = () => resize();
      resize();
      hero.addEventListener("pointermove", onMove, { passive: true });
      hero.addEventListener("pointerleave", onLeave);
      window.addEventListener("resize", onResize);
      cleanups.push(() => {
        hero.removeEventListener("pointermove", onMove);
        hero.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
      });
    }

    /* ---------- Pixel route canvas ---------- */
    const diag = document.querySelector<HTMLElement>(".route-diagram");
    const routeCvs = diag?.querySelector<HTMLCanvasElement>(".route-canvas");
    if (diag && routeCvs) {
      const ctx = routeCvs.getContext("2d")!;
      const SRC = [
        [0.879, 0.185],
        [0.898, 0.395],
        [0.886, 0.605],
        [0.887, 0.815],
      ];
      const MOD = [
        [0.104, 0.235],
        [0.096, 0.5],
        [0.104, 0.765],
      ];
      const HUB = [0.5, 0.5];
      type Particle = {
        t: number;
        phase: number;
        s: number[];
        hb: number[];
        m: number[];
        c1: number[];
        c3: number[];
        sp: number;
        trail: number[];
      };
      let w = 1;
      let h = 1;
      let visible = true;
      let raf = 0;
      let spawnRaf = 0;
      let last = 0;
      let acc = 0;
      let spawnPrev = 0;
      let si = 0;
      let nextModel = 0;
      const particles: Particle[] = [];
      const ripples: Array<{ x: number; y: number; r: number; a: number }> = [];
      let lattice: number[] = [];
      const px = (p: number[]) => [p[0] * w, p[1] * h];
      const quad = (a: number[], b: number[], c: number[], t: number) => {
        const u = 1 - t;
        return [
          u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
          u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
        ];
      };
      const resize = () => {
        const r = diag.getBoundingClientRect();
        w = Math.max(1, r.width);
        h = Math.max(1, r.height);
        const d = dpr();
        routeCvs.width = Math.floor(w * d);
        routeCvs.height = Math.floor(h * d);
        routeCvs.style.width = `${w}px`;
        routeCvs.style.height = `${h}px`;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        lattice = [];
        const gap = Math.max(34, Math.round(w / 30));
        for (let y = gap; y < h; y += gap) for (let x = gap; x < w; x += gap) lattice.push(x, y);
      };
      const spawn = (i: number) => {
        const s = px(SRC[i]);
        const hub = px(HUB);
        const m = px(MOD[nextModel]);
        nextModel = (nextModel + 1) % MOD.length;
        particles.push({
          t: 0,
          phase: 0,
          s,
          hb: hub,
          m,
          c1: [(s[0] + hub[0]) / 2, s[1]],
          c3: [(hub[0] + m[0]) / 2, hub[1]],
          sp: 0.0055 + Math.random() * 0.0028,
          trail: [],
        });
      };
      const draw = (ts: number) => {
        const dt = last ? Math.min(48, ts - last) : 16;
        last = ts;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(${ink.rgb},0.10)`;
        for (let i = 0; i < lattice.length; i += 2) {
          ctx.beginPath();
          ctx.arc(lattice[i], lattice[i + 1], 1, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let k = ripples.length - 1; k >= 0; k--) {
          const rp = ripples[k];
          rp.r += dt * 0.09;
          rp.a -= dt * 0.0016;
          if (rp.a <= 0) {
            ripples.splice(k, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(253,146,79,${rp.a.toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let p = particles.length - 1; p >= 0; p--) {
          const pt = particles[p];
          pt.t += pt.sp * dt;
          let pos: number[];
          if (pt.t <= 1) {
            pos = quad(pt.s, pt.c1, pt.hb, pt.t);
          } else {
            if (pt.phase === 0) {
              pt.phase = 1;
              ripples.push({ x: pt.hb[0], y: pt.hb[1], r: 4, a: 0.5 });
            }
            if (pt.t >= 2) {
              particles.splice(p, 1);
              ripples.push({ x: pt.m[0], y: pt.m[1], r: 3, a: 0.6 });
              continue;
            }
            pos = quad(pt.hb, pt.c3, pt.m, pt.t - 1);
          }
          pt.trail.push(pos[0], pos[1]);
          if (pt.trail.length > 32) pt.trail.splice(0, 2);
          for (let ti = 0; ti < pt.trail.length; ti += 2) {
            const a = (ti / pt.trail.length) * 0.42;
            ctx.fillStyle = `rgba(194,65,12,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(pt.trail[ti], pt.trail[ti + 1], 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#c2410c";
          ctx.beginPath();
          ctx.arc(pos[0], pos[1], 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        raf = visible ? requestAnimationFrame(draw) : 0;
      };
      const spawnLoop = (ts: number) => {
        const d = spawnPrev ? Math.min(64, ts - spawnPrev) : 16;
        spawnPrev = ts;
        if (visible) {
          acc += d;
          if (acc > 720) {
            acc = 0;
            spawn(si);
            si = (si + 1) % SRC.length;
          }
        }
        spawnRaf = visible ? requestAnimationFrame(spawnLoop) : 0;
      };
      const onResize = () => resize();
      const onVis = () => {
        visible = !document.hidden;
        last = 0;
        spawnPrev = 0;
        if (visible && !raf) raf = requestAnimationFrame(draw);
        if (visible && !spawnRaf) spawnRaf = requestAnimationFrame(spawnLoop);
      };
      resize();
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame(draw);
      spawnRaf = requestAnimationFrame(spawnLoop);
      cleanups.push(() => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        cancelAnimationFrame(raf);
        cancelAnimationFrame(spawnRaf);
      });
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
