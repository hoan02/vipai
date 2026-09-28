"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Icon } from "@/lib/icons";
import { refreshTranslations, useT } from "@/components/I18n";
import type { AuthMode } from "@/lib/auth-modal";

/* ------------------------------------------------------------------ *
 * Auth dialog
 *
 * Built on the site design system: sharp corners (--corner: 0), hairline
 * ink rules, dotted separators, mono captions and the amber→ruby brand
 * gradient — all the pieces globals.css already ships as tokens. Every
 * style lives in the `.am-*` block at the end of globals.css, next to
 * the top-up dialog, so no utility soup ends up in this file.
 *
 * Motion (all of it collapsible under prefers-reduced-motion):
 *   scrim fades while its dot grid drifts, the card settles with a
 *   hairline sweep across its top edge, rows cascade in staggered, the
 *   two panels swap vertically in the direction of travel, the form
 *   tweens its height so the card never jumps, fields draw an underline
 *   and float their label on focus, the password eye crossfades, the
 *   strength bars fill in sequence, the submit button runs a sheen, an
 *   error shakes, and success draws a check before the card exits.
 * ------------------------------------------------------------------ */

/* Copy is authored in Vietnamese — the source language of the site's
 * i18n dictionary — and resolved with useT() so EN readers see English. */
const COPY = {
  signin: {
    title: "Chào mừng trở lại",
    sub: "Đăng nhập để quản lý API key, credit và hạn mức.",
    cta: "Đăng nhập ngay",
    busy: "Đang xác thực…",
    foot: "Chưa có tài khoản?",
    footCta: "Đăng ký ngay",
  },
  signup: {
    title: "Bắt đầu với AiGiare",
    sub: "Miễn phí để bắt đầu, không cần thẻ tín dụng.",
    cta: "Tạo tài khoản miễn phí",
    busy: "Đang tạo tài khoản…",
    foot: "Đã có tài khoản?",
    footCta: "Đăng nhập ngay",
  },
} as const;

const STRENGTH = ["", "Yếu", "Trung bình", "Khá", "Mạnh"];
const EXIT_MS = 240;
const DONE_MS = 1150;
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Phase = "closed" | "open" | "closing";
type Status = "idle" | "busy" | "done";

/** Cheap strength heuristic: length first, then character-class variety. */
function strengthOf(pw: string) {
  if (!pw) return 0;
  let n = 0;
  if (pw.length >= 8) n++;
  if (pw.length >= 12) n++;
  if (/[a-z]/.test(pw) && /[A-Z0-9]/.test(pw)) n++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) n++;
  return Math.max(1, Math.min(4, n));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* ---------- inline glyphs: the sprite covers the brand marks, these
   cover the field icons the sprite does not ship ---------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <rect x="4.25" y="10.25" width="15.5" height="10" rx="2.5" />
      <path d="M8 10.25V7.5a4 4 0 0 1 8 0v2.75" />
    </svg>
  );
}

function UserGlyph() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <circle cx="12" cy="8.25" r="3.75" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
    </svg>
  );
}

function EyeGlyph({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.58-5.15 3.58-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/* ---------- field ---------- */

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  icon: ReactNode;
  className?: string;
  style?: CSSProperties;
  inputRef?: React.Ref<HTMLInputElement>;
  endAdorn?: ReactNode;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  icon,
  className,
  style,
  inputRef,
  endAdorn,
}: FieldProps) {
  return (
    <div className={`am-field${value ? " filled" : ""}${className ? ` ${className}` : ""}`} style={style}>
      <span className="am-field-ic">{icon}</span>
      <label className="am-lab" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {endAdorn}
    </div>
  );
}

/* ---------- dialog ---------- */

export function AuthModal() {
  const router = useRouter();
  const t = useT();

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("closed");
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<AuthMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Panels rise from below when moving signin→signup and drop in from
     above on the way back, so the swap reads as travel, not a blink. */
  const [dir, setDir] = useState(1);
  const [formH, setFormH] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const exitTimer = useRef(0);
  const doneTimer = useRef(0);
  const alive = useRef(true);

  const copy = COPY[mode];
  const busy = status === "busy";
  const done = status === "done";
  const live = mounted && phase !== "closed";
  const strength = strengthOf(password);

  useEffect(() => {
    alive.current = true;
    setMounted(true);
    return () => {
      alive.current = false;
      window.clearTimeout(exitTimer.current);
      window.clearTimeout(doneTimer.current);
      document.body.style.overflow = "";
    };
  }, []);

  const open = useCallback((next: AuthMode) => {
    window.clearTimeout(exitTimer.current);
    setMode(next);
    setStatus("idle");
    setError(null);
    setReveal(false);
    setPassword("");
    setFormH(null);
    setDir(1);
    setPhase("open");
    lastFocus.current = document.activeElement as HTMLElement | null;
    // The DOM i18n sweep runs at mount, before this dialog exists.
    refreshTranslations();
  }, []);

  const requestClose = useCallback(() => {
    if (status !== "idle") return;
    window.clearTimeout(exitTimer.current);
    setPhase("closing");
  }, [status]);

  /* Triggers: the [data-auth-modal] attribute anywhere on the page, plus the
     openAuthModal()/closeAuthModal() events the nav buttons dispatch. */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: AuthMode }>).detail;
      open(detail?.mode === "signup" ? "signup" : "signin");
    };
    const onClose = () => requestClose();
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement | null)?.closest?.("[data-auth-modal]");
      if (!trigger) return;
      e.preventDefault();
      open(trigger.getAttribute("data-auth-modal") === "signup" ? "signup" : "signin");
    };

    window.addEventListener("aigiare:open-auth", onOpen as EventListener);
    window.addEventListener("aigiare:close-auth", onClose);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("aigiare:open-auth", onOpen as EventListener);
      window.removeEventListener("aigiare:close-auth", onClose);
      document.removeEventListener("click", onClick);
    };
  }, [open, requestClose]);

  /* Exit animation, then unmount and hand focus back to the trigger. */
  useEffect(() => {
    if (phase !== "closing") return;
    exitTimer.current = window.setTimeout(
      () => {
        setPhase("closed");
        setStatus("idle");
        setFormH(null);
        lastFocus.current?.focus?.();
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    );
    return () => window.clearTimeout(exitTimer.current);
  }, [phase]);

  /* Scroll lock that leaves whatever the page had in place, plus the one
     autofocus. Keyed on `live` alone: re-running it when the request status
     changes would yank focus out of the field being typed into. */
  useEffect(() => {
    if (!live) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = window.setTimeout(() => emailRef.current?.focus(), 90);
    return () => {
      window.clearTimeout(focusFirst);
      document.body.style.overflow = previous;
    };
  }, [live]);

  /* Focus trap: Tab and Shift+Tab cycle the dialog instead of walking the
     page behind it. Escape is a no-op mid-request and on the success screen. */
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      ).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !cardRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [live, requestClose]);

  /* Measure the form with its pinned height lifted, before paint, then let
     the height tween run — the card resizes between modes instead of jumping. */
  useEffect(() => {
    if (!live) return;
    const el = formRef.current;
    if (!el) return;
    const pinned = el.style.height;
    el.style.height = "auto";
    const next = el.offsetHeight;
    el.style.height = pinned;
    if (next > 0) setFormH(next);
  }, [live, mode, status, error]);

  /* Success: hold the check-draw for a beat, then hand off to the router. */
  useEffect(() => {
    if (status !== "done") return;
    doneTimer.current = window.setTimeout(
      () => {
        setPhase("closed");
        router.push("/dashboard");
        router.refresh();
      },
      prefersReducedMotion() ? 120 : DONE_MS
    );
    return () => window.clearTimeout(doneTimer.current);
  }, [status, router]);

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setDir(next === "signup" ? 1 : -1);
    setMode(next);
    setStatus("idle");
    setError(null);
    setReveal(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;

    if (!email.trim()) {
      setError(t("Vui lòng nhập tên đăng nhập."));
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError(t("Mật khẩu cần ít nhất 8 ký tự."));
      return;
    }

    setError(null);
    setStatus("busy");

    try {
      const res = (
        await (mode === "signin"
          ? signIn.credential({ credential: email.trim(), password })
          : signUp.credential({
              username: email.trim(),
              password,
            }))
      ) as { error?: { message?: string } } | undefined;

      if (!alive.current) return;
      if (res?.error) {
        setError(
          mode === "signin"
            ? t("Tên đăng nhập hoặc mật khẩu không đúng.")
            : res.error.message || t("Không thể tạo tài khoản. Vui lòng thử lại.")
        );
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch (err) {
      if (!alive.current) return;
      const message = err instanceof Error && err.message ? err.message : "";
      setError(
        message && /^[\x20-\x7eÀ-ỹ\s.,!?'"()-]+$/.test(message)
          ? message
          : t("Có lỗi xảy ra. Vui lòng thử lại.")
      );
      setStatus("idle");
    }
  };

  const row = (i: number) => ({ "--i": i } as CSSProperties);

  /* Social sign-in leaves the page for the provider, so there is no local
     pending state to restore afterwards: the callback sets the session cookie
     and the user lands back here already signed in. */
  const signInWithGoogle = async () => {
    if (status !== "idle") return;
    setError(null);
    try {
      await signIn.social({ provider: "google" });
    } catch (err) {
      if (!alive.current) return;
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("Không thể kết nối với Google. Vui lòng thử lại.")
      );
    }
  };
  /* The scrim is the real backdrop target — the card is its sibling, so
     clicks that start inside the dialog never reach here. */
  const dismiss = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) requestClose();
  };

  if (!live) return null;

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    extra: Partial<Omit<FieldProps, "icon">> & { icon: ReactNode }
  ) => <Field id={id} label={label} value={value} onChange={onChange} {...extra} />;

  return createPortal(
    <div
      className={`am-root${phase === "closing" ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="am-title"
    >
      <div className="am-scrim" onMouseDown={dismiss} />

      <div className="am-card" ref={cardRef}>
        <div className="am-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="am-scroll" inert={done}>
          <header className="am-hd">
            <span className="am-mark">
              <Icon name="ic-aigiare" viewBox="0 0 24 24" width={20} height={20} />
            </span>
            <span className="am-hd-txt">
              <b>AiGiare</b>
              <small>AIGIARE · ACCOUNT</small>
            </span>
            <button className="am-x" type="button" onClick={requestClose} aria-label={t("Đóng")}>
              <Icon name="ic-x" viewBox="0 0 24 24" width={13} height={13} />
            </button>
          </header>

          <div className="am-tabs" role="group" aria-label={t("Tài khoản")}>
            <button
              className="am-tab"
              type="button"
              aria-pressed={mode === "signin"}
              disabled={busy}
              onClick={() => switchMode("signin")}
            >
              {t("Đăng nhập")}
            </button>
            <button
              className="am-tab"
              type="button"
              aria-pressed={mode === "signup"}
              disabled={busy}
              onClick={() => switchMode("signup")}
            >
              {t("Tạo tài khoản")}
            </button>
            <span className="am-tab-ind" style={{ "--am-tab": mode === "signup" ? 1 : 0 } as CSSProperties} />
          </div>

          <div className="am-body">
            <form
              key={mode}
              ref={formRef}
              className="am-form"
              style={{ "--am-h": formH ? `${formH}px` : "auto", "--am-py": `${dir * 12}px` } as CSSProperties}
              onSubmit={submit}
              noValidate
            >
              {error && (
                <p className="am-note err" role="alert">
                  <span className="am-note-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                      <circle cx="12" cy="12" r="8.6" />
                      <path d="M12 7.8v4.6M12 16.1h.01" />
                    </svg>
                  </span>
                  <span>{error}</span>
                </p>
              )}

              <h3 className="am-title am-row" id="am-title" style={row(1)}>
                {t(copy.title)}
              </h3>
              <p className="am-sub am-row" style={row(2)}>
                {t(copy.sub)}
              </p>

              {field("am-username", t("Tên đăng nhập"), email, setEmail, {
                type: "text",
                autoComplete: "username",
                icon: <UserGlyph />,
                inputRef: emailRef,
                className: "am-row",
                style: row(3),
              })}

              {field("am-password", t("Mật khẩu"), password, setPassword, {
                type: reveal ? "text" : "password",
                autoComplete: mode === "signin" ? "current-password" : "new-password",
                icon: <LockGlyph />,
                className: "am-row",
                style: row(mode === "signup" ? 5 : 4),
                endAdorn: (
                  <button
                    className="am-eye"
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? t("Ẩn mật khẩu") : t("Hiện mật khẩu")}
                    aria-pressed={reveal}
                  >
                    <span className="am-eye-in" key={reveal ? "on" : "off"}>
                      <EyeGlyph off={!reveal} />
                    </span>
                  </button>
                ),
              })}

              {mode === "signup" && (
                <div className="am-meter am-row" style={row(6)}>
                  <div className="am-meter-bars" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <i key={n} className={strength >= n ? "on" : ""} style={{ "--i": n } as CSSProperties} />
                    ))}
                  </div>
                  <div className="am-meter-cap">
                    <span>{t("Độ mạnh mật khẩu")}</span>
                    <b>{t(STRENGTH[strength])}</b>
                  </div>
                </div>
              )}

              <button
                className="am-submit am-row"
                style={row(mode === "signup" ? 7 : 5)}
                type="submit"
                disabled={status !== "idle"}
              >
                {busy ? (
                  <>
                    <span className="am-spin" aria-hidden="true" />
                    {t(copy.busy)}
                  </>
                ) : (
                  <>
                    {t(copy.cta)}
                    <Icon name="ic-arrow" className="am-arrow" viewBox="0 0 24 24" width={15} height={15} />
                  </>
                )}
              </button>

              <div className="am-alt-row am-row" style={row(mode === "signup" ? 8 : 6)}>
                <span className="am-alt-line" aria-hidden="true" />
                <span className="am-alt-txt">{t("hoặc")}</span>
                <span className="am-alt-line" aria-hidden="true" />
              </div>

              <button
                className="am-social am-row"
                style={row(mode === "signup" ? 9 : 7)}
                type="button"
                onClick={signInWithGoogle}
                disabled={status !== "idle"}
              >
                <GoogleGlyph />
                <span>{t("Tiếp tục với Google")}</span>
              </button>
            </form>

            <div className="am-ft">
              <div className="am-prov">
                <Icon name="ic-openai" viewBox="0 0 24 24" width={15} height={15} />
                <Icon name="ic-claude" viewBox="0 0 24 24" width={15} height={15} />
                <Icon name="ic-gemini" viewBox="0 0 24 24" width={15} height={15} />
                <span>{t("Một key cho mọi model")}</span>
              </div>
              <div className="am-alt">
                <span>{t(copy.foot)}</span>
                <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                  {t(copy.footCta)}
                </button>
              </div>
            </div>
          </div>
        </div>

        {done && (
          <div className="am-done" role="status">
            <div className="am-done-in">
              <span className="am-done-ring" aria-hidden="true">
                <i />
                <i />
                <i />
                <b>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path pathLength={1} d="m5 12.4 4.6 4.6L19 7.6" />
                  </svg>
                </b>
              </span>
              <h4>{mode === "signin" ? t("Đăng nhập thành công") : t("Tạo tài khoản thành công")}</h4>
              <p>{t("Đang chuyển tới bảng điều khiển…")}</p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
