"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession, signout } from "@/lib/auth-client";
import { TELEGRAM_URL } from "@/lib/site";
import { LogOut, LayoutDashboard, Shield, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

/** `key` indexes the `account` namespace in `messages/`. */
const items: { href: string; key: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profile", key: "profile", icon: UserRound },
  { href: "/dashboard/security", key: "security", icon: ShieldCheck },
];

function TelegramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 19 19.1c-.2 1-.8 1.2-1.6.8l-4.4-3.3-2.1 2c-.2.2-.4.4-.9.4l.3-4.5 8.2-7.4c.4-.3-.1-.5-.6-.2L6.8 13.1l-4.3-1.4c-.9-.3-.9-.9.2-1.3L20.6 3c.8-.3 1.5.2 1.3 1.3z" />
    </svg>
  );
}

export function UserButton() {
  const { data: session, isPending } = useSession();
  const t = useTranslations("account");
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (isPending) {
    return <div className="ub-av is-loading" aria-hidden="true" />;
  }

  if (!session?.user) {
    return null;
  }

  const email = session.user.email ?? "";
  const name = session.user.name || session.user.username || email;
  const initial = (name[0] || "U").toUpperCase();
  const isRoot = (session.user.role ?? 0) >= 100;
  const isOn = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await signout();
    } catch (err) {
      console.error("Signout error:", err);
    }
    window.location.href = "/";
  };

  return (
    <div className="ub" ref={menuRef} data-i18n-skip>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="ub-av"
        aria-label={t("menuLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="ub-menu" role="menu" aria-label={t("label")}>
          <div className="ub-head">
            <span className="ub-badge" aria-hidden="true">
              {initial}
            </span>
            <span className="ub-id">
              <span className="ub-name">{name}</span>
              <span className="ub-email">{email}</span>
            </span>
          </div>

          <div className="ub-list">
            {items.map(({ href, key, icon: I, exact }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`ub-item${isOn(href, exact) ? " is-on" : ""}`}
              >
                <I size={15} aria-hidden="true" />
                <span>{t(key)}</span>
              </Link>
            ))}
            {isRoot ? (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`ub-item${isOn("/admin") ? " is-on" : ""}`}
              >
                <Shield size={15} aria-hidden="true" />
                <span>{t("admin")}</span>
              </Link>
            ) : null}
            <a
              href={TELEGRAM_URL}
              role="menuitem"
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
              className="ub-item"
            >
              <TelegramIcon />
              <span>{t("support")}</span>
            </a>
          </div>

          <div className="ub-foot">
            <button type="button" role="menuitem" onClick={handleSignOut} className="ub-out">
              <LogOut size={15} aria-hidden="true" />
              <span>{t("signOut")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
