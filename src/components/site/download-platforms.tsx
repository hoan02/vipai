"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Apple, Check } from "lucide-react";

function WindowsMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.4v7.1H3zM11.6 4.2 21 3v8.5h-9.4zM3 12.5h7.5v7.1L3 18.5zM11.6 12.5H21V21l-9.4-1.3z" />
    </svg>
  );
}

/** `metaKey`/`reqKey` index the `platforms` namespace; the OS names are
 *  product names and stay as written. */
const platforms = [
  {
    id: "macos",
    os: "macOS",
    metaKey: "macMeta",
    reqKey: "macReq",
    icon: <Apple size={20} />,
  },
  {
    id: "windows",
    os: "Windows",
    metaKey: "winMeta",
    reqKey: "winReq",
    icon: <WindowsMark />,
  },
] as const;

export function DownloadPlatforms() {
  const t = useTranslations("platforms");
  const [started, setStarted] = useState<string | null>(null);

  return (
    <div className="dl-grid" data-i18n-skip>
      {platforms.map((p) => (
        <div className="panel dl-card" key={p.id}>
          <div className="os">
            {p.icon}
            {p.os}
          </div>
          <p className="meta">{t(p.metaKey)}</p>
          <button className="btn btn-primary btn-lg" type="button" onClick={() => setStarted(p.id)}>
            {started === p.id ? (
              <>
                <Check size={16} /> {t("downloadStarted")}
              </>
            ) : (
              t("downloadFor", { os: p.os })
            )}
          </button>
          <span className="req">{t(p.reqKey)}</span>
        </div>
      ))}
    </div>
  );
}
