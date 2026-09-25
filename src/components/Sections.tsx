import type { CSSProperties } from "react";
import { Icon } from "@/lib/icons";
import { agents, topModels } from "@/lib/data";
import { TELEGRAM_URL } from "@/lib/site";
import { RouteDecisionGraph } from "@/components/RouteDecisionGraph";

export function StatBar() {
  return (
    <section className="statbar" id="stats" aria-label="Routing statistics">
      <div className="statbar-in">
        <div className="sb-i">
          <b>139B+</b>
          <span>tokens routed yesterday</span>
        </div>
        <div className="sb-i">
          <b>&gt;99%</b>
          <span>prompt cache hit rate</span>
        </div>
        <div className="sb-i">
          <b>99.98%</b>
          <span>routing SLA</span>
        </div>
        <div className="sb-i">
          <b>Hours</b>
          <span>to new-model support</span>
        </div>
      </div>
    </section>
  );
}

export function BuyHook() {
  return (
    <section className="buy buy-hook" id="buyhook" aria-label="Pay less">
      <div className="buy-inner motion-preset-slide-up motion-duration-500">
        <h2 className="buy-title">
          Pay Less for <span className="grad">Every Token</span>
        </h2>
        <p className="buy-sub">
          Pay only for what you use. Model rates start at just 10% of the official price — discounts applied
          automatically, per model.
        </p>
        <div className="buy-actions">
          <button className="btn btn-primary btn-lg" type="button" data-topup>
            Buy credits
          </button>
          <a className="btn btn-ghost btn-lg" href="#quickstart">
            Quick setup
          </a>
        </div>
        <p className="buy-trust">Credits never expire · Buy credits anytime</p>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="section" id="features" aria-label="Running in production">
      <div className="sec-head">
        <h2 className="sec-title">Running in Production</h2>
        <p className="sec-sub">
          All three numbers come from live production traffic — the same data behind the pricing table and leaderboard on
          this page.
        </p>
      </div>
      <div className="metric-cards">
        <article className="mc-card mc-a ai-reveal motion-preset-slide-up motion-duration-500 motion-delay-0">
          <span className="mc-tag">
            <i aria-hidden="true" />
            Price
          </span>
          <span className="mc-num">
            90%<small>off</small>
          </span>
          <p className="mc-attr">
            6,000+ providers compete on price in real time under continuous quality monitoring, so every request gets the
            best available rate. Live pricing for every model is published on this page.
          </p>
        </article>
        <article className="mc-card mc-b ai-reveal motion-preset-slide-up motion-duration-500 motion-delay-75">
          <span className="mc-tag">
            <i aria-hidden="true" />
            Time to first token
          </span>
          <span className="mc-num">
            2.4<small>s</small>
          </span>
          <p className="mc-attr">
            Latency and throughput on par with going direct to the provider, measured across all production traffic.
            Slow routes are pulled from rotation within minutes; the live numbers are on this page.
          </p>
        </article>
        <article className="mc-card mc-c ai-reveal motion-preset-slide-up motion-duration-500 motion-delay-150">
          <span className="mc-tag">
            <i aria-hidden="true" />
            Uptime
          </span>
          <span className="mc-num">
            99.98<small>%</small>
          </span>
          <p className="mc-attr">
            Our Harness Routing engine backs a production-grade SLA and cache-hit guarantee: automatic failover across
            providers, around the clock, no downtime.
          </p>
        </article>
      </div>
    </section>
  );
}

const duoLeft = [
  {
    title: "Model Integrity",
    body: "Get exactly the model you request. Every request is routed to the model and protocol you select through vetted upstream providers, never silently swapped or downgraded.",
    icon: (
      <>
        <path d="M12 3.2 19 6v5.8c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z" />
        <polyline points="9.2 12.2 11.2 14.2 15 9.6" />
      </>
    ),
  },
  {
    title: "Data Privacy",
    body: "Prompts and completions are processed only for routing, metering, billing, abuse prevention, and support. Logs are never used to train models or sold as usage data.",
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    title: "Spend Tracking",
    body: "Billing details show every request, including model, token usage, applied discount, and final charge. Teams can see exactly where credits are spent instead of guessing from aggregate spend.",
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
    title: "Providers compete for your traffic",
    body: "Model providers compete for every request; only those that pass our quality gates are eligible. You get market rates without doing the price discovery yourself.",
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
    title: "Buy at scale",
    body: "We secure enterprise-scale volume commitments with vetted model providers. That is where the discount comes from.",
    icon: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
        <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
        <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
      </>
    ),
  },
  {
    title: "Investor-backed pricing",
    body: "Backed by leading funds, we're passing part of that on as price subsidies — a limited-time boost on top of volume discounts.",
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
];

function DuoColumn({ head, sub, items }: { head: string; sub: string; items: typeof duoLeft }) {
  return (
    <div>
      <div className="duo-head">
        <h2>{head}</h2>
        <p>{sub}</p>
      </div>
      <div className="duo-list">
        {items.map((it, i) => (
          <div
            className={`duo-card ai-lift ai-reveal motion-preset-slide-up motion-duration-500 ${
              ["motion-delay-0", "motion-delay-75", "motion-delay-100", "motion-delay-150", "motion-delay-200", "motion-delay-300"][Math.min(i, 5)]
            }`}
            key={it.title}
          >
            <span className="duo-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {it.icon}
              </svg>
            </span>
            <span className="duo-tx">
              <b>{it.title}</b>
              <span>{it.body}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Duo() {
  return (
    <section className="section" id="why" aria-label="Why AiGiare" style={{ paddingTop: 0 }}>
      <div className="duo ai-reveal">
        <DuoColumn
          head="A Router You Can Build Your Business On"
          sub="Traditional gateways weren't built for agent workloads. AiGiare is tuned for Claude Code, Codex, and long agentic sessions — without sacrificing the basics."
          items={duoLeft}
        />
        <DuoColumn
          head="How are the prices this low?"
          sub="One account, one bill. We vet providers, so you don't have to."
          items={duoRight}
        />
      </div>
    </section>
  );
}

export function Tier() {
  return (
    <section className="section" id="routing" aria-label="Production-grade routing" style={{ paddingTop: 0 }}>
      <div className="tier">
        <div className="tier-content">
          <span className="tier-eyebrow">Curated</span>
          <h3 className="tier-t">Production-grade routing</h3>
          <p className="tier-d">
            Routes that pass strict quality validation and latency testing — prioritizing availability, response speed and
            result consistency.
          </p>
          <ul className="tier-specs">
            <li>
              <span className="ts-k">Price</span>
              <span className="ts-v">Up to 92% off</span>
            </li>
            <li>
              <span className="ts-k">Latency</span>
              <span className="ts-v">First-token latency on par with official APIs</span>
            </li>
            <li>
              <span className="ts-k">Best for</span>
              <span className="ts-v">Production workloads · critical paths · quality-sensitive work</span>
            </li>
            <li>
              <span className="ts-k">Assurance</span>
              <span className="ts-v">Strict validation · continuous live monitoring &amp; replacement</span>
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

function rankRows(list: Array<{ n: string; tok: string; delta: string; req?: string; meta?: string }>) {
  return list.map((r, i) => {
    const down = r.delta.startsWith("↘");
    return (
      <div className="rank-row" key={r.n}>
        <span className="rank-i">{i + 1}.</span>
        <span className="rank-main">
          <span className="rank-name">{r.n}</span>
          <span className="rank-meta">{r.meta ?? r.req}</span>
        </span>
        <span className="rank-val">
          <span className="rank-tok">
            {r.tok}
            <small> tokens</small>
          </span>
          <span className={down ? "rank-down" : "rank-up"}>{r.delta}</span>
        </span>
      </div>
    );
  });
}

function VolumeChart() {
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
    <svg className="chart-svg" viewBox="0 0 640 220" preserveAspectRatio="none" role="img" aria-label="Daily token volume, last 14 days">
      {[0, 150, 300, 450].map((g) => (
        <line
          key={g}
          x1={vpad}
          y1={vy(g).toFixed(1)}
          x2={vw - vpad}
          y2={vy(g).toFixed(1)}
          stroke="#14110f"
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
  return (
    <section className="section" id="ranking" aria-label="Usage leaderboard" style={{ paddingTop: 0 }}>
      <div className="sec-head">
        <h2 className="sec-title">Usage leaderboard</h2>
        <p className="sec-sub">Updated daily at 00:00 UTC+8</p>
      </div>

      <div className="rank-grid ai-reveal">
        <div className="panel">
          <h3>Daily token volume</h3>
          <p className="panel-sub">Total tokens routed through AiGiare per day</p>
          <div className="vol-head">
            <span className="vol-n">
              354.3B<small>tokens</small>
            </span>
            <span className="vol-delta">↗ 11.0% vs yesterday</span>
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
            <h3>Top agents</h3>
            <p className="panel-sub">Ranked by tokens routed this week · change vs last week</p>
            <div className="rank-list">{rankRows(agents)}</div>
          </div>
          <div className="panel">
            <h3>Top models</h3>
            <p className="panel-sub">Ranked by tokens routed this week · change vs last week</p>
            <div className="rank-list">{rankRows(topModels)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="buy" id="buy" aria-label="Cut your AI spend">
      <div className="buy-inner motion-preset-slide-up motion-duration-500">
        <h2 className="buy-title">
          Cut Your AI Spend <span className="grad">up to 90%</span>
        </h2>
        <p className="buy-sub">
          Top up in the dashboard and usage is drawn down per request — so the budget you set goes further.
        </p>
        <div className="buy-actions">
          <button className="btn btn-primary btn-lg" type="button" data-topup>
            Buy credits
          </button>
        </div>
        <p className="buy-trust">Credits never expire · Buy credits anytime</p>
      </div>
    </section>
  );
}

export function Finale() {
  return (
    <>
      <div className="dither-fade" aria-hidden="true" />
      <section className="brand-finale" id="finale" aria-label="Closing">
        <div className="finale-band">
          <canvas className="dim-gl" aria-hidden="true" />
          <div className="dim-tx">
            <span className="dim-kick">
              <span>AiGiare</span>
            </span>
            <h2 className="dim-title">Every Request Takes The Best Route</h2>
          </div>
        </div>
      </section>
    </>
  );
}

const footCols = [
  {
    head: "Product",
    links: [
      { href: "/#pricing", label: "Pricing" },
      { href: "/download", label: "Download AiGiare" },
      { href: "/#ranking", label: "Leaderboard" },
      { href: "/#live", label: "Live discounts" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    head: "Resources",
    links: [
      { href: "/download", label: "Connect Harness" },
      { href: "/docs/api-integration", label: "API docs" },
    ],
  },
  {
    head: "Company",
    links: [
      { href: "#top", label: "About" },
      { href: "#top", label: "Blog" },
      { href: "#top", label: "Enterprise" },
      { href: "#top", label: "Privacy" },
      { href: "#top", label: "Terms of service" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-foot" aria-label="Footer">
      <div className="foot-top">
        <div className="fc fc-brand">
          <span className="b">
            <Icon name="ic-aigiare" viewBox="0 0 24 24" />
            AiGiare
          </span>
          <p className="foot-tag">The native billing and routing layer built for developers.</p>
          <div className="fc-touch">
            <span className="fc-k">
              <i aria-hidden="true" />
              STAY IN TOUCH
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
              <div className="foot-col" key={c.head}>
                <h4>{c.head}</h4>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="fc-endrow">
            <span className="fc-copy">© 2026 AiGiare HK Limited. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
