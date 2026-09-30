"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Brand names are the same in every locale; the rest index the `routeGraph`
 *  namespace. */
type Node = { id: string; lane: number; x: number; y: number; label?: string; labelKey?: string };
type Edge = { a: string; b: string };

const BOX_W = 88;
const BOX_H = 28;
const LANE_KEYS = ["laneAgent", "laneClassifier", "lanePolicy", "laneModel"];

const NODES: Node[] = [
  { id: "a1", label: "Claude Code", lane: 0, x: 8, y: 38 },
  { id: "a2", label: "Codex", lane: 0, x: 8, y: 82 },
  { id: "a3", label: "CC Switch", lane: 0, x: 8, y: 126 },
  { id: "a4", label: "OpenClaw", lane: 0, x: 8, y: 170 },
  { id: "c1", labelKey: "codeTools", lane: 1, x: 152, y: 86 },
  { id: "c2", labelKey: "chatContext", lane: 1, x: 152, y: 116 },
  { id: "p1", labelKey: "price", lane: 2, x: 296, y: 86 },
  { id: "p2", labelKey: "quality", lane: 2, x: 296, y: 56 },
  { id: "p3", labelKey: "latency", lane: 2, x: 296, y: 146 },
  { id: "m1", label: "Claude", lane: 3, x: 440, y: 38 },
  { id: "m2", label: "GPT", lane: 3, x: 440, y: 82 },
  { id: "m3", label: "Gemini", lane: 3, x: 440, y: 126 },
  { id: "m4", label: "DeepSeek", lane: 3, x: 440, y: 170 },
];

const EDGES: Array<Edge & { d: string }> = [
  { a: "a1", b: "c1", d: "M96 52 C124 52 124 100 152 100" },
  { a: "a2", b: "c1", d: "M96 96 C124 96 124 100 152 100" },
  { a: "a3", b: "c2", d: "M96 140 C124 140 124 130 152 130" },
  { a: "a4", b: "c2", d: "M96 184 C124 184 124 130 152 130" },
  { a: "c1", b: "p1", d: "M240 100 C268 100 268 100 296 100" },
  { a: "c2", b: "p3", d: "M240 130 C268 130 268 160 296 160" },
  { a: "c2", b: "p2", d: "M240 130 C268 130 268 70 296 70" },
  { a: "p2", b: "m1", d: "M384 70 C412 70 412 52 440 52" },
  { a: "p1", b: "m2", d: "M384 100 C412 100 412 96 440 96" },
  { a: "p3", b: "m3", d: "M384 130 C412 130 412 140 440 140" },
  { a: "p3", b: "m4", d: "M384 160 C412 160 412 184 440 184" },
];

function adjacency() {
  const map: Record<string, string[]> = {};
  EDGES.forEach(({ a, b }) => {
    (map[a] ||= []).push(b);
    (map[b] ||= []).push(a);
  });
  return map;
}

const ADJ = adjacency();

function connectedTo(id: string) {
  const seen: Record<string, boolean> = { [id]: true };
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift() as string;
    (ADJ[cur] || []).forEach((n) => {
      if (!seen[n]) {
        seen[n] = true;
        queue.push(n);
      }
    });
  }
  return seen;
}

export function RouteDecisionGraph() {
  const t = useTranslations("routeGraph");
  /** Brand names stay as written; everything else comes from the catalogue. */
  const nodeLabel = (n: Node) => (n.labelKey ? t(n.labelKey) : (n.label ?? ""));
  const [hovered, setHovered] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceRef = useRef(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const lit = hovered ? connectedTo(hovered) : null;
  const travelled = path.slice(0, stepIdx + 1);

  const run = useCallback(() => {
    if (running) return;
    const agents = ["a1", "a2", "a3", "a4"];
    const a = agents[Math.floor(Math.random() * agents.length)];
    const next = (ADJ[a] || [])[0];
    const policy = (ADJ[next] || []).filter((x) => x !== a)[0];
    const model = (ADJ[policy] || []).filter((x) => x !== next)[0];
    const route = [a, next, policy, model].filter(Boolean);

    setPath(route);

    if (reduceRef.current) {
      setStepIdx(route.length - 1);
      setRunning(false);
      return;
    }

    setRunning(true);
    setStepIdx(0);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (stepIdx >= path.length - 1) {
      setRunning(false);
      return;
    }
    const id = window.setTimeout(() => setStepIdx((v) => v + 1), 320);
    return () => window.clearTimeout(id);
  }, [running, stepIdx, path.length]);

  const isLit = (id: string) => (lit ? Boolean(lit[id]) : travelled.includes(id));
  const isDim = (id: string) => (lit ? !lit[id] : path.length > 0 && !travelled.includes(id));
  const edgeLit = (e: Edge) =>
    lit ? e.a === hovered || e.b === hovered : travelled.includes(e.a) && travelled.includes(e.b);

  return (
    <div className="tier-graph" ref={wrapRef}>
      <a className="tier-video" href="#telegram" aria-label={t("videoLabel")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/bg-curated.webp" alt="" width={960} height={540} loading="lazy" />
        <span className="tv-play" aria-hidden="true">
          <span>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </span>
        <span className="tv-cap">
          <b>{t("videoTitle")}</b>
          <em>{t("videoDuration")}</em>
        </span>
      </a>

      <div className="rdg-head">
        <span className="rdg-cap">{t("caption")}</span>
        <button className="rdg-run" type="button" aria-busy={running} onClick={run}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          <span>{running ? t("routing") : path.length ? t("runAgain") : t("run")}</span>
        </button>
      </div>

      <div className="rdg-stage">
        <svg
          className="rdg-svg"
          viewBox="0 0 560 260"
          role="img"
          aria-label={t("graphLabel")}
        >
          {LANE_KEYS.map((key, i) => (
            <text key={key} className="rdg-lane" x={8 + i * 144} y={14}>
              {t(key)}
            </text>
          ))}

          <g>
            {EDGES.map((e) => (
              <path
                key={`${e.a}-${e.b}`}
                className={`rdg-edge${edgeLit(e) ? " is-lit" : ""}${lit || path.length ? (edgeLit(e) ? "" : " is-dim") : ""}`}
                d={e.d}
              />
            ))}
          </g>

          <g>
            {NODES.map((n) => (
              <g
                key={n.id}
                className={`rdg-node${isLit(n.id) ? " is-lit" : ""}${isDim(n.id) ? " is-dim" : ""}${
                  hovered === n.id ? " is-hot" : ""
                }${stepIdx >= 0 && path[stepIdx] === n.id ? " is-active" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={nodeLabel(n)}
                onMouseEnter={() => !running && setHovered(n.id)}
                onMouseLeave={() => !running && setHovered(null)}
                onFocus={() => !running && setHovered(n.id)}
                onBlur={() => !running && setHovered(null)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    if (!running) setHovered(n.id);
                  }
                  if (ev.key === "Escape") setHovered(null);
                }}
              >
                <rect className="rdg-box" x={n.x} y={n.y} width={BOX_W} height={BOX_H} rx={8} />
                <text x={n.x + 12} y={n.y + 18}>
                  {nodeLabel(n)}
                </text>
                <rect className="rdg-hit" x={n.x} y={n.y} width={BOX_W} height={BOX_H} />
              </g>
            ))}
          </g>
        </svg>

        <div className="rdg-rail">
          <ol>
            {LANE_KEYS.map((key, i) => (
              <li className="rdg-step" key={key}>
                <span className="rdg-k">{t(key)}</span>
                <span className="rdg-v">
                  {NODES.filter((n) => n.lane === i).map((n) => (
                    <button
                      key={n.id}
                      className={`rdg-chip${isLit(n.id) ? " is-lit" : ""}`}
                      type="button"
                      onMouseEnter={() => !running && setHovered(n.id)}
                      onMouseLeave={() => !running && setHovered(null)}
                      onClick={() => !running && setHovered(n.id)}
                    >
                      {nodeLabel(n)}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
