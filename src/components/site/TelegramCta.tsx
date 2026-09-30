import { useTranslations } from "next-intl";
import { TELEGRAM_URL } from "@/lib/site";

export function TelegramCta() {
  const t = useTranslations("telegram");
  return (
    <section className="section" id="telegram" aria-label={t("label")} data-i18n-skip>
      <div className="tg-cta ai-reveal">
        <div className="stack ai-reveal-left">
          <span className="tg-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.9 4.3 19 19.1c-.2 1-.8 1.2-1.6.8l-4.4-3.3-2.1 2c-.2.2-.4.4-.9.4l.3-4.5 8.2-7.4c.4-.3-.1-.5-.6-.2L6.8 13.1l-4.3-1.4c-.9-.3-.9-.9.2-1.3L20.6 3c.8-.3 1.5.2 1.3 1.3z" />
            </svg>
            {t("badge")}
          </span>
          <h3>{t("title")}</h3>
          <p>{t("body")}</p>
        </div>
        <div className="stack ai-reveal">
          <a className="btn-solid ai-lift" href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
            {t("cta")}
          </a>
          <span className="form-note">{t("note")}</span>
        </div>
      </div>
    </section>
  );
}
