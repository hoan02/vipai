"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("hero");
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
      <button className={`hb-copy${copied ? " copied" : ""}`} type="button" aria-label={t("copyBaseUrl")} onClick={copy}>
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
  const t = useTranslations("hero");
  return (
      <div className="route-diagram" aria-label={t("diagramLabel")}>
        <canvas className="route-canvas" aria-hidden="true" />

        <div className="rd-note" style={{ left: "6%", top: "2%" }}>
          <i aria-hidden="true" />
          <span>{t("providers")}</span>
        </div>
        <div className="rd-note" style={{ right: "6%", top: "2%" }}>
          <i aria-hidden="true" />
          <span>{t("agents")}</span>
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
            <span>{t("smartRouting")}</span>
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
      <div className="agents-cap">{t("agentsCaption")}</div>
    </div>
  );
}

const capPills = [
  {
    key: "smartRouting",
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
    key: "promptCaching",
    path: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
        <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
        <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
      </>
    ),
  },
  {
    key: "autoFallbacks",
    path: (
      <>
        <path d="M20.5 12a8.5 8.5 0 1 1-2.9-6.4" />
        <polyline points="20.5 3.5 20.5 8.5 15.5 8.5" />
      </>
    ),
  },
  {
    key: "oneBill",
    path: (
      <>
        <path d="M6.5 2.5h8l3.5 3.5v15.5l-2.6-1.8-2.6 1.8-2.6-1.8-3.7 1.8z" />
        <line x1="9.5" y1="9" x2="15" y2="9" />
        <line x1="9.5" y1="13" x2="15" y2="13" />
      </>
    ),
  },
  {
    key: "spendTracking",
    path: (
      <>
        <path d="M3.5 3.5v17h17" />
        <polyline points="7 15 11 9.8 14 12.8 19.5 6" />
      </>
    ),
  },
  {
    key: "neverDowngraded",
    path: (
      <>
        <path d="M12 3.2 19 6v5.8c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z" />
        <polyline points="9.2 12.2 11.2 14.2 15 9.6" />
      </>
    ),
  },
];

function CapStrip() {
  const t = useTranslations("hero");
  return (
    <section className="capstrip" aria-label={t("capabilitiesLabel")}>
      <ul className="cap-pills">
        {capPills.map((p) => (
          <li key={p.key}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {p.path}
            </svg>
            <span>{t(p.key)}</span>
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
          {t.rich("trusted", { n: t("trustedCount"), b: (chunks) => <b>{chunks}</b> })}
        </p>
      </div>
    </section>
  );
}

export function Hero({ maxOff }: { maxOff: number }) {
  const t = useTranslations("hero");
  return (
    <div className="hero-wrap" id="top" data-i18n-skip>
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
            {t("eyebrow")}
          </div>
          <h1 className="t-stagger-line t-stagger-line--2">
            <span className="grad">{t("titleLead")}</span> <br />
            <span className="line2">{t("titleTrail", { n: maxOff })}</span>
          </h1>

          <div className="cta t-stagger-line t-stagger-line--3">
            <a className="btn btn-primary btn-lg" href="#telegram">
              <span className="knob" aria-hidden="true">
                <Icon name="ic-key" width={16} height={16} />
              </span>
              {t("getTokens")}
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
              <span>{t("chatTelegram")}</span>
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
