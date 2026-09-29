"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { usePrefsStore } from "@/lib/prefs-store";

type BannerMessage = { text: string; href: string; icon: ReactNode };

const messages: BannerMessage[] = [
  {
    text: "Free test tokens — try any model",
    href: "#telegram",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 4.5 13H11l-1 9 8.5-11H12z" />
      </svg>
    ),
  },
  {
    text: "Real models, never fake",
    href: "#faq",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.2 19 6v5.8c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z" />
        <polyline points="9.2 12.2 11.2 14.2 15 9.6" />
      </svg>
    ),
  },
  {
    text: "Fake found? Refund + 10× back",
    href: "#faq",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
        <polyline points="3.5 3.5 3.5 8.5 8.5 8.5" />
        <path d="M12 8.5v7M9.8 10.2h3.6a1.5 1.5 0 0 1 0 3h-2.8a1.5 1.5 0 0 0 0 3h3.6" />
      </svg>
    ),
  },
];

const ROTATE_MS = 4500;

/** Same local calendar day. A dismissal only covers the day it was made, so the
 *  banner is back after midnight instead of staying gone for a week. */
function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function LaunchBanner() {
  const dismissedAt = usePrefsStore((state) => state.launchBannerDismissedAt);
  const dismissBanner = usePrefsStore((state) => state.dismissLaunchBanner);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(0);

  // Read the persisted dismissal after mount so server and client agree.
  useEffect(() => {
    void usePrefsStore.persist.rehydrate();
  }, []);

  // Auto-hide once the page is scrolled past the banner. Unlike a dismissal this
  // keeps the reserved space (--lb-space), so nothing shifts; only --lb-h moves,
  // which slides the nav up and re-aligns the sticky pricing filters/header.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dismissedToday = dismissedAt !== null && isSameLocalDay(dismissedAt, Date.now());

  // Honour a dismissal from earlier the same day, mirroring the
  // static build's `launch-banner-off` root class.
  useEffect(() => {
    if (dismissedToday) {
      setHidden(true);
      document.documentElement.classList.add("launch-banner-off");
    }
  }, [dismissedToday]);

  useEffect(() => {
    const lifted = hidden || scrolled;
    document.documentElement.classList.toggle("lb-scrolled", scrolled);
    document.documentElement.style.setProperty("--lb-h", lifted ? "0px" : "44px");
    document.documentElement.style.setProperty("--lb-space", hidden ? "0px" : "44px");
  }, [hidden, scrolled]);

  useEffect(() => {
    if (hidden) return;
    const id = window.setInterval(() => setActive((v) => (v + 1) % messages.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [hidden]);

  if (hidden) return null;

  return (
    <div className="launch-banner is-stars is-entering" id="launchBanner">
      <canvas className="lb-stars" aria-hidden="true" />
      <a className="launch-banner-link" href={messages[active].href}>
        <span className="launch-banner-text">
          {messages.map((m, i) => (
            <span
              key={m.text}
              className={`lb-msg${i === active ? " is-on" : ""}`}
              aria-hidden={i !== active}
            >
              {m.icon}
              {m.text}
            </span>
          ))}
        </span>
        <Icon name="ic-arrow" width={16} height={16} className="launch-banner-arrow" />
      </a>
      <button
        type="button"
        className="launch-banner-close"
        aria-label="Dismiss announcement"
        onClick={() => {
          dismissBanner(Date.now());
          document.documentElement.classList.add("launch-banner-off");
          setHidden(true);
        }}
      >
        <Icon name="ic-x" width={15} height={15} />
      </button>
    </div>
  );
}
