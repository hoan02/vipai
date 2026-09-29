"use client";

import { useState } from "react";
import { Check, Copy, WrapText } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Token colouring
 *
 * Language-aware on purpose. `//` opens a comment in JavaScript and is part of
 * every URL, so a single comment rule turns https://api.vipai.site grey.
 * And a JSON payload nested in a shell argument spans lines, so `-d '{` has to
 * switch the grammar until the closing quote rather than colouring the whole
 * body as one string.
 * ------------------------------------------------------------------ */

const KEYWORDS =
  "export|from|const|let|var|function|return|import|async|await|for|while|in|if|else|class|new|try|catch|require|package|def|print|use|func|fn|impl|struct|public|private|echo|curl|set|unset";

const KW = new Set(KEYWORDS.split("|"));
const LIT = new Set(["true", "false", "null", "True", "False", "None"]);

/** Languages whose comment marker is `#` rather than `//`. */
const HASH_COMMENT = new Set([
  "bash", "sh", "shell", "env", "powershell", "ps1",
  "python", "py", "ruby", "rb", "yaml", "yml", "toml", "ini",
]);

/** Languages whose grammar is the shell grammar. */
const SHELL = new Set(["bash", "sh", "shell", "env"]);

export type CodeLang = "bash" | "sh" | "shell" | "env" | "json" | "javascript" | "typescript" | "python" | "powershell" | "text";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightLine(src: string, lang: CodeLang): string {
  const re = HASH_COMMENT.has(lang)
    ? /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$.-]*)/gm
    : /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/gm;

  return src.replace(re, (whole, comment, str, num, id: string | undefined) => {
    if (comment) return `<span class="t-cm">${comment}</span>`;
    if (str) return `<span class="t-st">${str}</span>`;
    if (num) return `<span class="t-nu">${num}</span>`;
    if (!id) return whole;
    if (LIT.has(id)) return `<span class="t-li">${id}</span>`;
    if (KW.has(id)) return `<span class="t-kw">${id}</span>`;
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(id)) return `<span class="t-cn">${id}</span>`;
    return id;
  });
}

function highlightJson(src: string): string {
  return escapeHtml(src).replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g,
    (whole, str: string, colon: string | undefined, num: string | undefined, lit: string | undefined) => {
      if (str) return colon ? `<span class="t-key">${str}</span>${colon}` : `<span class="t-st">${str}</span>`;
      if (num) return `<span class="t-nu">${num}</span>`;
      if (lit) return `<span class="t-li">${lit}</span>`;
      return whole;
    },
  );
}

export function highlight(code: string, lang: CodeLang = "text"): string {
  if (lang === "text") return escapeHtml(code);
  if (lang === "json") return highlightJson(code);

  if (SHELL.has(lang)) {
    const out: string[] = [];
    let inPayload = false;
    for (const line of code.split("\n")) {
      if (!inPayload && /-d\s*'/.test(line)) {
        const cut = line.indexOf("'");
        // Everything after the opening quote belongs to the payload. On a
        // multi-line `-d '{` that is just the brace, and dropping it left every
        // curl sample in the docs un-copyable.
        const rest = line.slice(cut + 1);
        out.push(
          `${highlightLine(escapeHtml(line.slice(0, cut)), lang)}<span class="t-pn">&#39;</span>${highlight(rest, "json")}`,
        );
        inPayload = true;
        continue;
      }
      if (inPayload) {
        if (/'\s*$/.test(line)) {
          const j = line.lastIndexOf("'");
          out.push(`${highlight(line.slice(0, j), "json")}<span class="t-pn">&#39;</span>`);
          inPayload = false;
        } else {
          out.push(highlight(line, "json"));
        }
        continue;
      }
      out.push(highlightLine(escapeHtml(line), lang));
    }
    return out.join("\n");
  }

  return highlightLine(escapeHtml(code), lang);
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export type CodeTab = { label: string; file?: string; lang?: CodeLang; code: string };

export function CodeBlock({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);

  if (tabs.length === 0) return null;
  const current = tabs[Math.min(active, tabs.length - 1)] ?? tabs[0]!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
    } catch {
      // Clipboard can be blocked on an insecure origin or by permissions.
      // A hidden textarea keeps the control useful rather than dead.
      const ta = document.createElement("textarea");
      ta.value = current.code;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing else to try */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`doc-code${wrap ? " is-wrap" : ""}`}>
      {tabs.length > 1 ? (
        <div className="doc-code-tabs" role="tablist" aria-label="Code language">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              id={`ct-${i}`}
              aria-controls={`cp-${i}`}
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="doc-code-bar">
        <span className="doc-code-file">{current.file ?? current.label}</span>
        <span className="doc-code-sp" />
        <button type="button" className="doc-code-act" onClick={() => setWrap((v) => !v)} aria-pressed={wrap}>
          <WrapText size={14} aria-hidden="true" />
          Wrap
        </button>
        <button type="button" className="doc-code-act" onClick={copy}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {tabs.map((t, i) =>
        i === active ? (
          <pre
            key={t.label}
            id={`cp-${i}`}
            role={tabs.length > 1 ? "tabpanel" : undefined}
            aria-labelledby={tabs.length > 1 ? `ct-${i}` : undefined}
            tabIndex={0}
          >
            <code dangerouslySetInnerHTML={{ __html: highlight(t.code, t.lang ?? "text") }} />
          </pre>
        ) : null,
      )}
    </div>
  );
}

/** Single-snippet shorthand. */
export function Code({ label, file, code, lang }: { label?: string; file?: string; code: string; lang?: CodeLang }) {
  return <CodeBlock tabs={[{ label: label ?? "code", file, code, lang: lang ?? "text" }]} />;
}
