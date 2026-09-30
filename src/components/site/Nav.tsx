"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { openAuthModal } from "@/lib/auth-modal";
import { UserButton } from "@/components/UserButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/lib/icons";
import { brandMark, languages } from "@/lib/data";

/** `key` indexes the `nav` namespace in `messages/`; the label is never typed
 *  here, so the two locales cannot drift. */
type NavLink = { href: string; key: string; active?: boolean };

const links: NavLink[] = [
  { href: "/", key: "home", active: true },
  { href: "/pricing", key: "pricing" },
  { href: "/models", key: "models" },
  { href: "/download", key: "codex" },
  { href: "/docs", key: "docs" },
  { href: "/dashboard", key: "dashboard" },
];

export function Nav() {
  const { data: session, isPending } = useSession();
  const t = useTranslations("nav");
  // The URL is the locale. Nothing here reads or writes localStorage: switching
  // language navigates to the other locale's path, which is what makes the
  // choice crawlable and shareable.
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <nav className="nav-pill" aria-label={t("primary")} data-i18n-skip>
      <div className="nav-in">
        <Link className="brand" href="/">
          <Icon name={brandMark} className="logo" width={32} height={22} />
          <span className="brand-name">VipAI</span>
        </Link>

        <div className={`nav-scrim${menuOpen ? " open" : ""}`} onClick={close} />
        <div className={`links${menuOpen ? " open" : ""}`} id="navLinks">
          <div className="nav-sheet-head">
            <span className="nav-grip" aria-hidden="true" />
            <span className="nav-user">
              <span className="nav-user-av" />
              <span className="nav-user-tx">
                <span className="nav-user-id">{session?.user?.email || "VipAI"}</span>
                <span className="nav-user-sub">
                  {session?.user ? t("signedIn") : t("notSignedIn")}
                </span>
              </span>
            </span>
          </div>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              // Signed out, `/dashboard` answers with a redirect to the auth
              // dialog. Prefetching it would only cache that bounce, so leave it
              // to the click. Once signed in it prefetches like any other link.
              prefetch={l.href === "/dashboard" && !session?.user ? false : undefined}
              className={l.active ? "is-active" : undefined}
              onClick={close}
            >
              {t(l.key)}
            </Link>
          ))}
        </div>

        <div className="actions">
          <ThemeToggle className="icon-btn" />
          <div className="lang-wrap" ref={wrapRef}>
            <button
              className="icon-btn"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t("language")}
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
            <div className={`lang-menu${langOpen ? " open" : ""}`} role="listbox" aria-label={t("language")}>
              {languages.map((l) => (
                <button
                  key={l.id}
                  className="lang-opt"
                  type="button"
                  role="option"
                  aria-selected={locale === l.id}
                  onClick={() => {
                    setLangOpen(false);
                    if (l.id !== locale) router.replace(pathname, { locale: l.id as Locale });
                  }}
                >
                  {/* Endonyms: a language is offered in its own language, so
                      these labels are deliberately not translated. */}
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
              {t("getApiKey")}
            </button>
          )}
          {!isPending && session?.user && (
            <>
              <Link className="login-btn" href="/dashboard">
                {t("dashboard")}
              </Link>
              <UserButton />
            </>
          )}
          <button
            className="nav-burger"
            type="button"
            aria-label={t("menu")}
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
