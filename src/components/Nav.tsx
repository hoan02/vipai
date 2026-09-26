"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { openAuthModal } from "@/lib/auth-modal";
import { UserButton } from "@/components/UserButton";
import { Icon } from "@/lib/icons";
import { languages } from "@/lib/data";
import { TELEGRAM_URL } from "@/lib/site";
import { setLocale } from "@/components/I18n";

const links = [
  { href: "/", label: "Home", active: true },
  { href: "/#pricing", label: "Pricing" },
  { href: "/download", label: "Connect Codex" },
  { href: "/docs", label: "API docs" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const { data: session, isPending } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("vi");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = (localStorage.getItem("aigiare.locale") as "en" | "vi") || "vi";
    setLang(stored);
    document.documentElement.lang = stored;
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <nav className="nav-pill" aria-label="Primary">
      <div className="nav-in">
        <a className="brand" href="/">
          <Icon name="ic-aigiare" className="logo" viewBox="0 0 24 24" />
          <span className="brand-name">AiGiare</span>
        </a>

        <div className={`nav-scrim${menuOpen ? " open" : ""}`} onClick={close} />
        <div className={`links${menuOpen ? " open" : ""}`} id="navLinks">
          <div className="nav-sheet-head">
            <span className="nav-grip" aria-hidden="true" />
            <span className="nav-user">
              <span className="nav-user-av" />
              <span className="nav-user-tx">
                <span className="nav-user-id">{session?.user?.email || "AiGiare"}</span>
                <span className="nav-user-sub">
                  {session?.user ? "Signed in" : "Not signed in"}
                </span>
              </span>
            </span>
          </div>
          {links.map((l) => (
            <a key={l.label} href={l.href} className={l.active ? "is-active" : undefined} onClick={close}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="actions">
          <a
            className="icon-btn"
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Chat on Telegram"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.9 4.3 19 19.1c-.2 1-.8 1.2-1.6.8l-4.4-3.3-2.1 2c-.2.2-.4.4-.9.4l.3-4.5 8.2-7.4c.4-.3-.1-.5-.6-.2L6.8 13.1l-4.3-1.4c-.9-.3-.9-.9.2-1.3L20.6 3c.8-.3 1.5.2 1.3 1.3z" />
            </svg>
          </a>
          <div className="lang-wrap" ref={wrapRef}>
            <button
              className="icon-btn"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label="Language"
              onClick={(e) => {
                e.stopPropagation();
                setLangOpen((v) => !v);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </button>
            <div className={`lang-menu${langOpen ? " open" : ""}`} role="listbox" aria-label="Language">
              {languages.map((l) => (
                <button
                  key={l.id}
                  className="lang-opt"
                  type="button"
                  role="option"
                  aria-selected={lang === l.id}
                  onClick={() => {
                    setLang(l.id);
                    setLocale(l.id as "en" | "vi");
                    setLangOpen(false);
                  }}
                >
                  {l.label}
                  <Icon name="ic-check" className="ck" />
                </button>
              ))}
            </div>
          </div>
          {!isPending && !session?.user && (
            <button
              className="login-btn cursor-pointer"
              type="button"
              onClick={() => openAuthModal("signin")}
            >
              Get API key
            </button>
          )}
          {!isPending && session?.user && (
            <>
              <Link className="login-btn" href="/dashboard">
                Dashboard
              </Link>
              <UserButton />
            </>
          )}
          <button
            className="nav-burger"
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg className="ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <svg className="ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
