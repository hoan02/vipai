"use client";

import { useEffect } from "react";

/**
 * Mounts the four canvas/CSS motion layers once, mirroring the static build:
 * scroll reveal, launch-banner star field, hero ASCII lens, cursor spotlight
 * and the route flow canvas. Everything is a no-op under reduced motion.
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

    /* ---------- Route flow canvas ----------
       Soft light-lines replace the old particle dots. Four model links on
       the left and four client links on the right meet at the hub, carry
       marching dashes for a constant left-to-right pull, and hand off
       periodic "comets": tapered light streaks that ease through the hub
       and bloom into a ring on arrival. */
    const diag = document.querySelector<HTMLElement>(".route-diagram");
    const routeCvs = diag?.querySelector<HTMLCanvasElement>(".route-canvas");
    if (diag && routeCvs) {
      const ctx = routeCvs.getContext("2d")!;
      const HUB = [0.5, 0.5];
      const TAU = Math.PI * 2;
      const TAIL = [194, 65, 12];
      const HEAD = [255, 138, 60];
      const COOL = [96, 142, 255];
      type Pt = [number, number];
      type Curve = { a: Pt; b: Pt; c: Pt; d: Pt };
      type Flow = { seg1: Curve; seg2: Curve; t: number; sp: number; through: boolean; mi: number; ci: number };

      let w = 1;
      let h = 1;
      let visible = true;
      let active = true;
      let raf = 0;
      let spawnRaf = 0;
      let last = 0;
      let acc = 0;
      let spawnPrev = 0;
      let mi = 0;
      let ci = 0;
      let MODELS: Pt[] = [];
      let CLIENTS: Pt[] = [];
      const flows: Flow[] = [];
      const rings: Array<{ x: number; y: number; r: number; a: number; wd: number }> = [];
      const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; r: number }> = [];
      const motes: Array<{ x: number; y: number; r: number; life: number }> = [];
      const hot = new Map<HTMLElement, number>();
      let modelEls: HTMLElement[] = [];
      let clientEls: HTMLElement[] = [];
      let hubEl: HTMLElement | null = null;
      let fan: Curve[] = [];
      let lattice: number[] = [];
      let baseGrad: CanvasGradient | null = null;
      let dashGrad: CanvasGradient | null = null;

      const pt = (p: number[]): Pt => [p[0] * w, p[1] * h];
      const hubPt = (): Pt => [HUB[0] * w, HUB[1] * h];
      /* Horizontal tangents at both ends keep every join at the hub smooth. */
      const curve = (from: Pt, to: Pt): Curve => {
        const dx = (to[0] - from[0]) * 0.5;
        return { a: from, b: [from[0] + dx, from[1]], c: [to[0] - dx, to[1]], d: to };
      };
      const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
        const u = 1 - t;
        const uu = u * u;
        const tt = t * t;
        return [
          uu * u * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + tt * t * p3[0],
          uu * u * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + tt * t * p3[1],
        ];
      };
      const ease = (x: number) => 0.34 * x + 0.66 * x * x * (3 - 2 * x);
      const at = (c: Curve, t: number) => cubic(c.a, c.b, c.c, c.d, ease(Math.max(0, Math.min(1, t))));
      const flowAt = (f: Flow, t: number): Pt => (t <= 1 ? at(f.seg1, t) : at(f.seg2, t - 1));
      const trace = (c: Curve) => {
        ctx.beginPath();
        ctx.moveTo(c.a[0], c.a[1]);
        ctx.bezierCurveTo(c.b[0], c.b[1], c.c[0], c.c[1], c.d[0], c.d[1]);
      };
      /* The cards are laid out left/right aligned, so their label widths decide
         where an edge sits. Read the live DOM instead of guessing: lines start
         at each model card's right edge and stop at each client card's left
         edge, with a few px of breathing room. */
      const anchors = (els: HTMLElement[], edge: "left" | "right", dx: number): Pt[] => {
        const host = diag.getBoundingClientRect();
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          const x = (edge === "right" ? r.right : r.left) - host.left + dx;
          return [x / w, (r.top - host.top + r.height / 2) / h];
        });
      };
      /* Light a card or the hub for a beat. Deadlines live in a Map so the
         animation loop retires them and a newer ping on the same element is
         never cleared early. */
      const flash = (el: HTMLElement | null) => {
        if (!el) return;
        el.classList.add("route-hot");
        hot.set(el, performance.now() + 520);
      };
      const burst = (x: number, y: number, n: number, speed: number) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.random() * 0.6;
          const sp = speed * (0.55 + Math.random() * 0.8);
          sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: 1.1 + Math.random() * 1.5 });
        }
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
        /* Hidden below the stacking breakpoint: stop all work until it is back. */
        active = routeCvs.offsetWidth > 0;
        if (!active) {
          hot.forEach((_, el) => el.classList.remove("route-hot"));
          hot.clear();
          return;
        }
        modelEls = Array.from(diag.querySelectorAll<HTMLElement>(".route-models .route-node"));
        clientEls = Array.from(diag.querySelectorAll<HTMLElement>(".route-srcs .route-node"));
        hubEl = diag.querySelector<HTMLElement>(".route-node.hub");
        MODELS = anchors(modelEls, "right", 6);
        CLIENTS = anchors(clientEls, "left", -8);
        active = MODELS.length > 0 && CLIENTS.length > 0;
        if (!active) return;
        const hub = hubPt();
        fan = [...MODELS.map((m) => curve(pt(m), hub)), ...CLIENTS.map((s) => curve(hub, pt(s)))];
        const rgb = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        baseGrad = ctx.createLinearGradient(0, 0, w, 0);
        baseGrad.addColorStop(0, rgb(TAIL, 0));
        baseGrad.addColorStop(0.16, rgb(TAIL, 0.2));
        baseGrad.addColorStop(0.46, rgb(HEAD, 0.42));
        baseGrad.addColorStop(0.7, rgb(COOL, 0.22));
        baseGrad.addColorStop(1, rgb(COOL, 0));
        dashGrad = ctx.createLinearGradient(0, 0, w, 0);
        dashGrad.addColorStop(0, rgb(TAIL, 0));
        dashGrad.addColorStop(0.2, rgb(TAIL, 0.44));
        dashGrad.addColorStop(0.5, rgb(HEAD, 0.62));
        dashGrad.addColorStop(0.84, rgb(COOL, 0.36));
        dashGrad.addColorStop(1, rgb(COOL, 0));
        lattice = [];
        const gap = Math.max(34, Math.round(w / 30));
        for (let y = gap; y < h; y += gap) for (let x = gap; x < w; x += gap) lattice.push(x, y);
      };
      const spawn = () => {
        if (!MODELS.length || !CLIENTS.length) return;
        const hub = hubPt();
        const src = mi;
        const dst = ci;
        flows.push({
          seg1: curve(pt(MODELS[src]), hub),
          seg2: curve(hub, pt(CLIENTS[dst])),
          t: 0,
          sp: 0.00072 + Math.random() * 0.00032,
          through: false,
          mi: src,
          ci: dst,
        });
        flash(modelEls[src] ?? null);
        mi = (mi + 1) % MODELS.length;
        ci = (ci + 1) % CLIENTS.length;
      };
      const ring = (x: number, y: number, r: number, a: number, wd: number) => rings.push({ x, y, r, a, wd });
      const draw = (ts: number) => {
        if (!active) {
          raf = 0;
          return;
        }
        const dt = last ? Math.min(48, ts - last) : 16;
        last = ts;
        ctx.clearRect(0, 0, w, h);

        const now = performance.now();
        hot.forEach((end, el) => {
          if (end <= now) {
            el.classList.remove("route-hot");
            hot.delete(el);
          }
        });

        ctx.fillStyle = `rgba(${ink.rgb},0.07)`;
        for (let i = 0; i < lattice.length; i += 2) {
          ctx.beginPath();
          ctx.arc(lattice[i], lattice[i + 1], 1, 0, TAU);
          ctx.fill();
        }

        ctx.lineCap = "round";
        if (baseGrad) {
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = baseGrad;
          for (const c of fan) {
            trace(c);
            ctx.stroke();
          }
        }
        if (dashGrad) {
          ctx.save();
          ctx.setLineDash([3, 13]);
          ctx.lineDashOffset = (-ts * 0.05) % 16;
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = dashGrad;
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(ts / 640);
          for (const c of fan) {
            trace(c);
            ctx.stroke();
          }
          ctx.restore();
        }

        for (let i = motes.length - 1; i >= 0; i--) {
          const m = motes[i];
          m.life -= dt * 0.0016;
          if (m.life <= 0) {
            motes.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(${HEAD[0]},${HEAD[1]},${HEAD[2]},${(m.life * 0.45).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, Math.max(0.2, m.r * m.life), 0, TAU);
          ctx.fill();
        }

        for (let k = rings.length - 1; k >= 0; k--) {
          const rp = rings[k];
          rp.r += dt * 0.085;
          rp.a -= dt * 0.0013;
          if (rp.a <= 0) {
            rings.splice(k, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(${HEAD[0]},${HEAD[1]},${HEAD[2]},${rp.a.toFixed(3)})`;
          ctx.lineWidth = rp.wd;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.r, 0, TAU);
          ctx.stroke();
        }

        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life -= dt * 0.0024;
          if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vx *= 0.93;
          s.vy *= 0.93;
          ctx.fillStyle = `rgba(${HEAD[0]},${HEAD[1]},${HEAD[2]},${(s.life * s.life * 0.85).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, Math.max(0.3, s.r * (0.35 + s.life * 0.65)), 0, TAU);
          ctx.fill();
        }

        const N = 26;
        const GAP = 0.032;
        for (let p = flows.length - 1; p >= 0; p--) {
          const f = flows[p];
          f.t += f.sp * dt;
          if (f.t > 2) {
            const end = f.seg2.d;
            ring(end[0], end[1], 3.5, 0.62, 1.6);
            burst(end[0], end[1], 8, 0.085);
            flash(clientEls[f.ci] ?? null);
            flows.splice(p, 1);
            continue;
          }
          if (!f.through && f.t >= 1) {
            f.through = true;
            const hub = f.seg1.d;
            ring(hub[0], hub[1], 5, 0.5, 1.6);
            burst(hub[0], hub[1], 5, 0.055);
            flash(hubEl);
          }
          for (let i = 0; i < N; i++) {
            const t1 = f.t - i * GAP;
            if (t1 <= 0) break;
            const a = flowAt(f, t1);
            const b = flowAt(f, Math.max(0, f.t - (i + 1) * GAP));
            if (i === N - 1 && motes.length < 140 && Math.random() < 0.08) {
              motes.push({ x: a[0], y: a[1], r: 1.7, life: 1 });
            }
            const k = 1 - i / N;
            const cr = Math.round(TAIL[0] + (HEAD[0] - TAIL[0]) * k);
            const cg = Math.round(TAIL[1] + (HEAD[1] - TAIL[1]) * k);
            const cb = Math.round(TAIL[2] + (HEAD[2] - TAIL[2]) * k);
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(k * k * 0.62).toFixed(3)})`;
            ctx.lineWidth = 0.5 + k * 2.9;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
          const head = flowAt(f, Math.min(f.t, 2));
          const halo = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 17);
          halo.addColorStop(0, `rgba(${HEAD[0]},${HEAD[1]},${HEAD[2]},0.5)`);
          halo.addColorStop(0.55, `rgba(${HEAD[0]},${HEAD[1]},${HEAD[2]},0.14)`);
          halo.addColorStop(1, `rgba(${HEAD[0]},${HEAD[1]},${HEAD[2]},0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(head[0], head[1], 17, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "#c2410c";
          ctx.beginPath();
          ctx.arc(head[0], head[1], 2.3, 0, TAU);
          ctx.fill();
        }
        raf = visible ? requestAnimationFrame(draw) : 0;
      };
      const spawnLoop = (ts: number) => {
        if (!active) {
          spawnRaf = 0;
          return;
        }
        const d = spawnPrev ? Math.min(64, ts - spawnPrev) : 16;
        spawnPrev = ts;
        if (visible) {
          acc += d;
          if (acc > 900) {
            acc = 0;
            spawn();
          }
        }
        spawnRaf = visible ? requestAnimationFrame(spawnLoop) : 0;
      };
      const onResize = () => {
        resize();
        if (!active) return;
        if (!raf) raf = requestAnimationFrame(draw);
        if (!spawnRaf) spawnRaf = requestAnimationFrame(spawnLoop);
      };
      const onVis = () => {
        visible = !document.hidden;
        last = 0;
        spawnPrev = 0;
        if (visible && active && !raf) raf = requestAnimationFrame(draw);
        if (visible && active && !spawnRaf) spawnRaf = requestAnimationFrame(spawnLoop);
      };
      resize();
      /* Re-measure once webfonts land, otherwise card widths can be off. */
      document.fonts?.ready.then(onResize).catch(() => {});
      if (active) {
        spawn();
        raf = requestAnimationFrame(draw);
        spawnRaf = requestAnimationFrame(spawnLoop);
      }
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        cancelAnimationFrame(raf);
        cancelAnimationFrame(spawnRaf);
        hot.forEach((_, el) => el.classList.remove("route-hot"));
        hot.clear();
      });
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
