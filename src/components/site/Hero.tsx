"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/lib/icons";
import { brandMark, protocols } from "@/lib/data";
import { TELEGRAM_URL } from "@/lib/site";

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(ta);
}

function HeroBaseUrl() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(protocols[0]);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const copy = () => {
    copyText(`https://api.vipai.site${current.path}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={`hero-baseurl${open ? " open" : ""}`} ref={wrapRef}>
      <button
        className="hb-proto"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span>{current.label}</span>
        <Icon name="ic-chevron" />
      </button>
      <code className="hb-url">
        <span className="scheme">https://</span>api.vipai.site
        {current.path ? <span className="path">{current.path}</span> : null}
      </code>
      <button className={`hb-copy${copied ? " copied" : ""}`} type="button" aria-label="Copy base URL" onClick={copy}>
        <Icon name="ic-copy" className="ic-copy" />
        <Icon name="ic-check" className="ic-check" />
      </button>
      <div className={`hb-menu`} role="listbox" aria-label="Base URL" style={{ display: open ? "block" : undefined }}>
        <div className="hb-menu-label">BASE URL</div>
        {protocols.map((p) => (
          <button
            key={p.id}
            className={`hb-opt${current.id === p.id ? " is-on" : ""}`}
            type="button"
            role="option"
            aria-selected={current.id === p.id}
            onClick={() => {
              setCurrent(p);
              setOpen(false);
            }}
          >
            {p.label}
            <Icon name="ic-check" className="ck" />
          </button>
        ))}
      </div>
    </div>
  );
}

function RouteDiagram() {
  return (
      <div className="route-diagram" aria-label="Smart routing diagram">
        <canvas className="route-canvas" aria-hidden="true" />

        <div className="rd-note" style={{ left: "6%", top: "2%" }}>
          <i aria-hidden="true" />
          <span>MODEL PROVIDERS</span>
        </div>
        <div className="rd-note" style={{ right: "6%", top: "2%" }}>
          <i aria-hidden="true" />
          <span>CODING AGENTS &amp; CLIENTS</span>
        </div>

      <div className="route-srcs">
        <div className="route-node src n-claude" style={{ top: "18.5%" }}>
          <Icon name="ic-claudecode" className="lg" />
          <span className="nm">Claude Code</span>
        </div>
        <div className="route-node src n-codex" style={{ top: "39.5%" }}>
          <Icon name="ic-codex" className="lg" />
          <span className="nm">Codex</span>
        </div>
        <div className="route-node src n-ccswitch" style={{ top: "60.5%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lg" src="/assets/cc-switch.webp" alt="" aria-hidden="true" width={23} height={23} />
          <span className="nm">CC Switch</span>
        </div>
        <div className="route-node src n-openclaw" style={{ top: "81.5%" }}>
          <Icon name="ic-openclaw" className="lg" />
          <span className="nm">OpenClaw</span>
        </div>
      </div>

      <div className="route-arrow a1" aria-hidden="true">
        <Icon name="ic-chevron" />
      </div>

      <div className="route-node hub" style={{ left: "50%", top: "50%" }}>
        <span className="hub-core">
          <span className="hub-pulse" aria-hidden="true" />
          <Icon name={brandMark} className="lg" width={40} height={28} />
        </span>
        <ul className="hub-caps">
          <li>
            <i style={{ "--c": "#fd924f" } as CSSProperties} />
            <span>Smart Routing</span>
          </li>
        </ul>
      </div>

      <div className="route-arrow a2" aria-hidden="true">
        <Icon name="ic-chevron" />
      </div>

      <div className="route-models">
        <div className="route-node model n-claude" style={{ top: "18.5%" }}>
          <Icon name="ic-claude" className="lg" />
          <span className="nm">Claude</span>
        </div>
        <div className="route-node model n-gpt" style={{ top: "39.5%" }}>
          <Icon name="ic-openai" className="lg" />
          <span className="nm">GPT</span>
        </div>
        <div className="route-node model n-gemini" style={{ top: "60.5%" }}>
          <Icon name="ic-gemini" className="lg" />
          <span className="nm">Gemini</span>
        </div>
        <div className="route-node model n-deepseek" style={{ top: "81.5%" }}>
          <Icon name="ic-deepseek" className="lg" />
          <span className="nm">DeepSeek</span>
        </div>
      </div>
      <div className="agents-cap">Works with 10+ coding agents and clients</div>
    </div>
  );
}

const capPills = [
  {
    label: "Smart Routing",
    path: (
      <>
        <polyline points="16 3 21 3 21 8" />
        <line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" />
        <line x1="15" y1="15" x2="21" y2="21" />
        <line x1="4" y1="4" x2="9" y2="9" />
      </>
    ),
  },
  {
    label: "Prompt Caching",
    path: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
        <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
        <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
      </>
    ),
  },
  {
    label: "Auto Fallbacks",
    path: (
      <>
        <path d="M20.5 12a8.5 8.5 0 1 1-2.9-6.4" />
        <polyline points="20.5 3.5 20.5 8.5 15.5 8.5" />
      </>
    ),
  },
  {
    label: "One Bill",
    path: (
      <>
        <path d="M6.5 2.5h8l3.5 3.5v15.5l-2.6-1.8-2.6 1.8-2.6-1.8-3.7 1.8z" />
        <line x1="9.5" y1="9" x2="15" y2="9" />
        <line x1="9.5" y1="13" x2="15" y2="13" />
      </>
    ),
  },
  {
    label: "Spend Tracking",
    path: (
      <>
        <path d="M3.5 3.5v17h17" />
        <polyline points="7 15 11 9.8 14 12.8 19.5 6" />
      </>
    ),
  },
  {
    label: "Never Downgraded",
    path: (
      <>
        <path d="M12 3.2 19 6v5.8c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z" />
        <polyline points="9.2 12.2 11.2 14.2 15 9.6" />
      </>
    ),
  },
];

function CapStrip() {
  return (
    <section className="capstrip" aria-label="Core capabilities and social proof">
      <ul className="cap-pills">
        {capPills.map((p) => (
          <li key={p.label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {p.path}
            </svg>
            <span>{p.label}</span>
          </li>
        ))}
      </ul>
      <div className="trusted">
        <span className="tr-av" aria-hidden="true">
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/trust-ama.png" alt="" width={19} height={19} loading="lazy" />
          </span>
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Icon name={brandMark} width={19} height={14} />
          </span>
          <span>
            <Icon name="ic-bolt" />
          </span>
        </span>
        <p>
          Trusted by <b>6,000+</b> dev teams and indie builders
        </p>
      </div>
    </section>
  );
}

export function Hero({ maxOff }: { maxOff: number }) {
  return (
    <div className="hero-wrap" id="top">
      <div className="art-bg" aria-hidden="true" />
      <canvas className="hero-ascii" aria-hidden="true" />
      <div className="hero-flow" aria-hidden="true">
        <span className="b b1" />
        <span className="b b2" />
        <span className="b b3" />
      </div>
      <div className="hero-glow" aria-hidden="true" />
      <div className="stage">
        <header className="hero t-stagger" data-early-reveal="1">
          <div className="hero-eyebrow t-stagger-line">
            <span className="he-dot" aria-hidden="true" />
            OpenAI-compatible · one key · one bill
          </div>
          <h1 className="t-stagger-line t-stagger-line--2">
            <span className="grad">Every frontier model</span> <br />
            <span className="line2" data-i18n="one key, up to {n}% off list" data-i18n-n={String(maxOff)}>
              one key, up to {maxOff}% off list
            </span>
          </h1>

          <div className="cta t-stagger-line t-stagger-line--3">
            <a className="btn btn-primary btn-lg" href="#telegram">
              <span className="knob" aria-hidden="true">
                <Icon name="ic-key" width={16} height={16} />
              </span>
              Get free test tokens
              <span className="btn-fx" aria-hidden="true">
                <span className="fx-star s1" />
                <span className="fx-star s2" />
                <span className="fx-star s3" />
              </span>
            </a>
            <a
              className="btn btn-ghost btn-lg btn-tagged"
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>Chat on Telegram</span>
              <span className="btn-tag">@vipai</span>
              <span className="btn-fly" aria-hidden="true">
                <span className="fly-trail" />
                <Icon name="ic-telegram" className="fly-plane" width={14} height={14} />
              </span>
            </a>
          </div>

          <div className="hero-meta t-stagger-line t-stagger-line--4">
            <HeroBaseUrl />
          </div>
        </header>

        <div className="hero-lower">
          <RouteDiagram />
        </div>

        <CapStrip />
      </div>
    </div>
  );
}
