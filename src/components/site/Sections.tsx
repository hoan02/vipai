import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/lib/icons";
import { agents, brandMark, topModels, type RankRow } from "@/lib/data";
import { TELEGRAM_URL } from "@/lib/site";
import { RouteDecisionGraph } from "@/components/site/RouteDecisionGraph";

export function StatBar() {
  const t = useTranslations("stats");
  return (
    <section className="statbar" id="stats" aria-label={t("label")} data-i18n-skip>
      <div className="statbar-in">
        <div className="sb-i">
          <b>139B+</b>
          <span>{t("tokens")}</span>
        </div>
        <div className="sb-i">
          <b>&gt;99%</b>
          <span>{t("cache")}</span>
        </div>
        <div className="sb-i">
          <b>99.98%</b>
          <span>{t("sla")}</span>
        </div>
        <div className="sb-i">
          <b>{t("supportValue")}</b>
          <span>{t("support")}</span>
        </div>
      </div>
    </section>
  );
}

export function BuyHook({ maxOff }: { maxOff: number }) {
  const t = useTranslations("buy");
  return (
    <section className="buy buy-hook" id="buyhook" aria-label={t("hookLabel")} data-i18n-skip>
      <div className="buy-inner ai-reveal">
        <h2 className="buy-title">
          <span>{t("payLessFor")}</span> <span className="grad">{t("everyToken")}</span>
        </h2>
        <p className="buy-sub">{t("hookSub", { pct: 100 - maxOff })}</p>
        <div className="buy-actions">
          <button className="btn btn-primary btn-lg" type="button" data-topup>
            {t("buyCredits")}
          </button>
          <a className="btn btn-ghost btn-lg" href="#quickstart">
            {t("quickSetup")}
          </a>
        </div>
        <p className="buy-trust">{t("trust")}</p>
      </div>
    </section>
  );
}

export function Features({ maxOff }: { maxOff: number }) {
  const t = useTranslations("features");
  return (
    <section className="section" id="features" aria-label={t("label")} data-i18n-skip>
      <div className="sec-head">
        <h2 className="sec-title">{t("title")}</h2>
        <p className="sec-sub">{t("sub")}</p>
      </div>
      <div className="metric-cards">
        <article className="mc-card mc-a ai-reveal">
          <span className="mc-tag">
            <i aria-hidden="true" />
            {t("priceTag")}
          </span>
          <span className="mc-num">
            {maxOff}%<small>{t("priceUnit")}</small>
          </span>
          <p className="mc-attr">{t("priceBody")}</p>
        </article>
        <article className="mc-card mc-b ai-reveal" style={{ animationDelay: "75ms" }}>
          <span className="mc-tag">
            <i aria-hidden="true" />
            {t("ttftTag")}
          </span>
          <span className="mc-num">
            2.4<small>{t("ttftUnit")}</small>
          </span>
          <p className="mc-attr">{t("ttftBody")}</p>
        </article>
        <article className="mc-card mc-c ai-reveal" style={{ animationDelay: "150ms" }}>
          <span className="mc-tag">
            <i aria-hidden="true" />
            {t("uptimeTag")}
          </span>
          <span className="mc-num">
            99.98<small>{t("uptimeUnit")}</small>
          </span>
          <p className="mc-attr">{t("uptimeBody")}</p>
        </article>
      </div>
    </section>
  );
}

const duoLeft = [
  {
    key: "modelIntegrity",
    icon: (
      <>
        <path d="M12 3.2 19 6v5.8c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z" />
        <polyline points="9.2 12.2 11.2 14.2 15 9.6" />
      </>
    ),
  },
  {
    key: "dataPrivacy",
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    key: "spendTracking",
    icon: (
      <>
        <path d="M3.5 3.5v17h17" />
        <polyline points="7 15 11 9.8 14 12.8 19.5 6" />
      </>
    ),
  },
];

const duoRight = [
  {
    key: "providersCompete",
    icon: (
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
    key: "buyAtScale",
    icon: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
        <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
        <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
      </>
    ),
  },
  {
    key: "investorPricing",
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
];

function DuoColumn({ head, sub, items }: { head: string; sub: string; items: typeof duoLeft }) {
  const t = useTranslations("duo");
  return (
    <div>
      <div className="duo-head">
        <h2>{head}</h2>
        <p>{sub}</p>
      </div>
      <div className="duo-list">
        {items.map((it, i) => (
          <div
            className="duo-card ai-lift ai-reveal"
            style={{ animationDelay: `${[0, 75, 100, 150, 200, 300][Math.min(i, 5)]}ms` }}
            key={it.key}
          >
            <span className="duo-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {it.icon}
              </svg>
            </span>
            <span className="duo-tx">
              <b>{t(`items.${it.key}.title`)}</b>
              <span>{t(`items.${it.key}.body`)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Duo() {
  const t = useTranslations("duo");
  return (
    <section className="section" id="why" aria-label={t("label")} style={{ paddingTop: 0 }} data-i18n-skip>
      <div className="duo ai-reveal">
        <DuoColumn head={t("leftHead")} sub={t("leftSub")} items={duoLeft} />
        <DuoColumn head={t("rightHead")} sub={t("rightSub")} items={duoRight} />
      </div>
    </section>
  );
}

export function Tier({ maxOff }: { maxOff: number }) {
  const t = useTranslations("tier");
  return (
    <section
      className="section"
      id="routing"
      aria-label={t("label")}
      style={{ paddingTop: 0 }}
      data-i18n-skip
    >
      <div className="tier">
        <div className="tier-content">
          <span className="tier-eyebrow">{t("eyebrow")}</span>
          <h3 className="tier-t">{t("title")}</h3>
          <p className="tier-d">{t("body")}</p>
          <ul className="tier-specs">
            <li>
              <span className="ts-k">{t("price")}</span>
              <span className="ts-v">{t("priceValue", { n: maxOff })}</span>
            </li>
            <li>
              <span className="ts-k">{t("latency")}</span>
              <span className="ts-v">{t("latencyValue")}</span>
            </li>
            <li>
              <span className="ts-k">{t("bestFor")}</span>
              <span className="ts-v">{t("bestForValue")}</span>
            </li>
            <li>
              <span className="ts-k">{t("assurance")}</span>
              <span className="ts-v">{t("assuranceValue")}</span>
            </li>
          </ul>
        </div>
        <div className="tier-media">
          <RouteDecisionGraph />
        </div>
      </div>
    </section>
  );
}

/** A `t` narrowed to what this file hands around; see `lib/faq.ts`. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

function rankRows(list: RankRow[], t: Translate) {
  return list.map((r, i) => {
    const down = r.delta.startsWith("↘");
    return (
      <div className="rank-row" key={r.n}>
        <span className="rank-i">{i + 1}.</span>
        <span className="rank-main">
          <span className="rank-name">{r.n}</span>
          <span className="rank-meta">
            {r.requests
              ? t("requests", { n: r.requests })
              : t("modelMeta", { ms: r.ttft ?? "", pct: r.success ?? "" })}
          </span>
        </span>
        <span className="rank-val">
          <span className="rank-tok">
            {r.tok}
            <small> {t("tokensUnit")}</small>
          </span>
          <span className={down ? "rank-down" : "rank-up"}>{r.delta}</span>
        </span>
      </div>
    );
  });
}

function VolumeChart() {
  const t = useTranslations("leaderboard");
  const days = 14;
  const dv: number[] = [];
  for (let j = 0; j < days; j++) dv.push(150 + 60 * Math.sin(j / 2.4) + j * 7 + (j % 4 === 2 ? 22 : 0));
  const vw = 640;
  const vh = 220;
  const vpad = 8;
  const maxV = 450;
  const barW = (vw - 2 * vpad) / days;
  const vy = (v: number) => vh - vpad - (v / maxV) * (vh - 2 * vpad);
  return (
    <svg className="chart-svg" viewBox="0 0 640 220" preserveAspectRatio="none" role="img" aria-label={t("chartLabel")}>
      {[0, 150, 300, 450].map((g) => (
        <line
          key={g}
          x1={vpad}
          y1={vy(g).toFixed(1)}
          x2={vw - vpad}
          y2={vy(g).toFixed(1)}
          style={{ stroke: "var(--ink)" }}
          strokeOpacity=".08"
          strokeWidth="1"
        />
      ))}
      {dv.map((v, k) => {
        const h = vh - vpad - vy(v);
        return (
          <rect
            key={k}
            x={(vpad + k * barW + 3).toFixed(1)}
            y={vy(v).toFixed(1)}
            width={(barW - 6).toFixed(1)}
            height={h.toFixed(1)}
            fill={k === days - 1 ? "#c2410c" : "#f97316"}
            fillOpacity={k === days - 1 ? 1 : 0.52}
          />
        );
      })}
    </svg>
  );
}

export function Leaderboard() {
  const t = useTranslations("leaderboard");
  return (
    <section className="section" id="ranking" aria-label={t("label")} style={{ paddingTop: 0 }} data-i18n-skip>
      <div className="sec-head">
        <h2 className="sec-title">{t("title")}</h2>
        <p className="sec-sub">{t("sub")}</p>
      </div>

      <div className="rank-grid ai-reveal">
        <div className="panel">
          <h3>{t("dailyVolume")}</h3>
          <p className="panel-sub">{t("dailyVolumeSub")}</p>
          <div className="vol-head">
            <span className="vol-n">
              354.3B<small>{t("tokensUnit")}</small>
            </span>
            <span className="vol-delta">{t("volumeDelta")}</span>
          </div>
          <VolumeChart />
          <div className="vol-axis">
            <span>450B</span>
            <span>300B</span>
            <span>150B</span>
            <span>0B</span>
          </div>
        </div>

        <div className="od-stack" style={{ "--od-gap": "16px" } as CSSProperties}>
          <div className="panel">
            <h3>{t("topAgents")}</h3>
            <p className="panel-sub">{t("rankSub")}</p>
            <div className="rank-list">{rankRows(agents, t)}</div>
          </div>
          <div className="panel">
            <h3>{t("topModels")}</h3>
            <p className="panel-sub">{t("rankSub")}</p>
            <div className="rank-list">{rankRows(topModels, t)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CtaSection({ maxOff }: { maxOff: number }) {
  const t = useTranslations("buy");
  return (
    <section className="buy" id="buy" aria-label={t("ctaLabel")} data-i18n-skip>
      <div className="buy-inner ai-reveal">
        <h2 className="buy-title">
          {t("cutSpendTitle")} <span className="grad">{t("cutSpendAmount", { n: maxOff })}</span>
        </h2>
        <p className="buy-sub">{t("ctaSub")}</p>
        <div className="buy-actions">
          <button className="btn btn-primary btn-lg" type="button" data-topup>
            {t("buyCredits")}
          </button>
        </div>
        <p className="buy-trust">{t("trust")}</p>
      </div>
    </section>
  );
}

export function Finale() {
  const t = useTranslations("finale");
  return (
    <>
      <div className="dither-fade" aria-hidden="true" />
      <section className="brand-finale" id="finale" aria-label={t("label")} data-i18n-skip>
        <div className="finale-band">
          <canvas className="dim-gl" aria-hidden="true" />
          <div className="dim-tx">
            <span className="dim-kick">
              <span>VipAI</span>
            </span>
            <h2 className="dim-title">{t("title")}</h2>
          </div>
        </div>
      </section>
    </>
  );
}

/** `headKey`/`key` index the `footer` namespace in `messages/`. */
const footCols = [
  {
    headKey: "product",
    links: [
      { href: "/pricing", key: "pricing" },
      { href: "/models", key: "models" },
      { href: "/download", key: "download" },
      { href: "/#ranking", key: "leaderboard" },
      { href: "/#live", key: "liveDiscounts" },
      { href: "/dashboard", key: "dashboard" },
    ],
  },
  {
    headKey: "resources",
    links: [
      { href: "/docs", key: "documentation" },
      { href: "/download", key: "connectHarness" },
      { href: "/docs/api-integration", key: "apiDocs" },
      { href: "/docs/models", key: "modelsRouting" },
    ],
  },
  {
    headKey: "company",
    links: [
      { href: "/about", key: "about" },
      { href: "/legal/privacy", key: "privacy" },
      { href: "/legal/terms", key: "terms" },
    ],
  },
];

export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="site-foot" aria-label="Footer" data-i18n-skip>
      <div className="foot-top">
        <div className="fc fc-brand">
          <span className="b">
            <Icon name={brandMark} width={32} height={22} />
            VipAI
          </span>
          <p className="foot-tag">{t("tagline")}</p>
          <div className="fc-touch">
            <span className="fc-k">
              <i aria-hidden="true" />
              {t("stayInTouch")}
            </span>
            <span className="fc-soc">
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener" aria-label="Telegram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M21.9 4.3 19 19.1c-.2 1-.8 1.2-1.6.8l-4.4-3.3-2.1 2c-.2.2-.4.4-.9.4l.3-4.5 8.2-7.4c.4-.3-.1-.5-.6-.2L6.8 13.1l-4.3-1.4c-.9-.3-.9-.9.2-1.3L20.6 3c.8-.3 1.5.2 1.3 1.3z" />
                </svg>
              </a>
              <a href="#top" aria-label="X">
                <Icon name="ic-x" />
              </a>
              <a href="#top" aria-label="Discord">
                <Icon name="ic-discord" />
              </a>
              <a href="#top" aria-label="LinkedIn">
                <Icon name="ic-linkedin" />
              </a>
              <a href="#top" aria-label="YouTube">
                <Icon name="ic-youtube" />
              </a>
            </span>
          </div>
        </div>
        <div className="fc fc-links">
          <nav className="foot-cols" aria-label="Footer navigation">
            {footCols.map((c) => (
              <div className="foot-col" key={c.headKey}>
                <h4>{t(c.headKey)}</h4>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.key}>
                      <Link href={l.href}>{t(l.key)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="fc-endrow">
            <span className="fc-copy">{t("copyright")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
