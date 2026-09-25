"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { codeSnippets, quickstartLangs, quickstartSubs, quickstartTabs } from "@/lib/data";

const TOKEN =
  /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(from|import|const|let|var|new|await|async|for|of|in|return|def|class|public|static|void|package|func|use|fn|require|print|echo|puts|do|end|else|elif|if|try|catch|True|False|None|true|false|null)\b/g;

function highlight(line: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let i = 0;
  while ((m = TOKEN.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const cls = m[1] ? "cm" : m[2] ? "st" : "kw";
    out.push(
      <span className={cls} key={i++}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out.length ? out : "\u00a0";
}

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

const sideCards = [
  { icon: "/assets/router.webp", title: "Full setup guides", sub: "Step-by-step for popular clients and SDKs" },
  { icon: "/assets/key.webp", title: "Download AiGiare for Codex", sub: "Download the AiGiare desktop app, setup done for you (new users)" },
  { icon: "/assets/shield-check.webp", title: "View API docs", sub: "Endpoints, SDKs, and protocol details" },
  { icon: "/assets/ico-curated.webp", title: "OpenClaw / CC-Switch", sub: "Install guides for other clients and CLI tools" },
];

export function QuickStart() {
  const [tab, setTab] = useState("api");
  const [sub, setSub] = useState("claude-code");
  const [lang, setLang] = useState<string>("python");
  const [copied, setCopied] = useState(false);

  const isApi = tab === "api";
  const isCli = tab === "cli";
  const isDesktop = tab === "codex" || tab === "claude";
  const isOther = tab === "other";
  const showCode = isApi || isCli;

  const snippet = codeSnippets[lang];

  const onCopy = () => {
    copyText(snippet?.code.replace(/<[^>]+>/g, "") ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="section" id="quickstart" aria-label="Quick start">
      <div className="sec-head">
        <h2 className="sec-title">Quick start</h2>
        <p className="sec-sub">
          Point your existing tools at AiGiare. A one-line change — official SDKs, standard endpoints, nothing to
          relearn. Also works with Codex, Claude Desktop, OpenClaw, CC-Switch and any OpenAI-compatible client.
        </p>
      </div>

      <div className="qsx ai-reveal motion-preset-slide-up motion-duration-500">
        <div className="qsx-side">
          {sideCards.map((c) => (
            <a className="qsx-card ai-lift" href="#quickstart" key={c.title}>
              <span className="qsx-ico">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.icon} alt="" width={24} height={24} />
              </span>
              <span className="qsx-tx">
                <b>{c.title}</b>
                <span>{c.sub}</span>
              </span>
              <span className="qsx-go">
                <Icon name="ic-arrow" />
              </span>
            </a>
          ))}
        </div>

        <div className="qsx-main">
          <div className="qsx-tabs" role="tablist" aria-label="Quick start clients">
            {quickstartTabs.map((t) => (
              <button
                key={t.id}
                className="qsx-tab"
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="qsx-panes">
            {showCode ? (
              <div className="qsx-langs" role="tablist" aria-label="Languages">
                {quickstartLangs.map((l) => (
                  <button
                    key={l}
                    className="qsx-lang"
                    type="button"
                    role="tab"
                    aria-selected={lang === l}
                    onClick={() => setLang(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            ) : null}

            {isCli ? (
              <div className="qsx-subs">
                {quickstartSubs.map((s) => (
                  <button
                    key={s.id}
                    className="qsx-sub"
                    type="button"
                    aria-selected={sub === s.id}
                    onClick={() => setSub(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}

            {showCode && snippet ? (
              <div className="qsx-code">
                <div className="qsx-bar">
                  <span className="qsx-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="qsx-file">{snippet.file}</span>
                  <span className="qsx-model">
                    <Icon name="ic-openai" style={{ color: "#efe7df" }} />
                    <span>{snippet.model}</span>
                  </span>
                  <button className={`qsx-copy${copied ? " copied" : ""}`} type="button" onClick={onCopy}>
                    <Icon name="ic-copy" />
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="qsx-body">
                  <pre tabIndex={0}>
                    {snippet.code.split("\n").map((line, i) => (
                      <span className="ln" key={i}>
                        <i aria-hidden="true">{i + 1}</i>
                        <code>{line ? highlight(line) : "\u00a0"}</code>
                      </span>
                    ))}
                  </pre>
                </div>
              </div>
            ) : null}

            {isDesktop ? (
              <div className="qsx-app">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/qs-app-shot.png"
                  alt="AiGiare desktop app onboarding screen"
                  width={1432}
                  height={1360}
                  loading="lazy"
                />
              </div>
            ) : null}

            {isOther ? (
              <div>
                <div className="od-grid" style={{ "--od-cols": 3 } as CSSProperties}>
                  {[
                    { t: "OpenClaw", i: "/assets/ico-curated.webp" },
                    { t: "CC-Switch", i: "/assets/router.webp" },
                    { t: "WorkBuddy", i: "/assets/key.webp" },
                  ].map((c) => (
                    <a className="qsx-card" href="#quickstart" key={c.t}>
                      <span className="qsx-ico">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.i} alt="" width={24} height={24} />
                      </span>
                      <span className="qsx-tx">
                        <b>{c.t}</b>
                        <span>Install guide</span>
                      </span>
                      <span className="qsx-go">
                        <Icon name="ic-arrow" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {showCode ? (
              <p className="qsx-note">
                Point the base URL at AiGiare, drop in your API key — the rest of your code stays the same.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
