# AiGiare — Next.js 16 app

Full Next.js rebuild of the AiGiare landing page plus a real backend:
**Next.js 16 App Router + TypeScript + Tailwind CSS + `lucide-react`**, the
ported design system, Clerk authentication and a Prisma/Postgres data layer.

## Run

```bash
cd nextjs
npm install
cp .env.example .env.local     # then fill in DATABASE_URL (Clerk keys may already exist)
npm run db:push                # create the tables (needs DATABASE_URL)
npm run dev                    # http://localhost:3000
```

Clerk dev keys are already written to `.env.local` (provisioned by
`npx clerk@latest init`); run `npx clerk@latest auth login` to claim the app for
your own Clerk account.

`DATABASE_URL` is optional to boot: without it the app runs and every
repository falls back to bundled demo data, so the dashboard still renders.
Once it is set, `npm run db:generate` + `npm run db:push` turn on real
persistence for API keys, usage and test-token requests.

## Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Framework  | Next.js 16 App Router (`src/app/`), React 19                 |
| Language   | TypeScript                                                   |
| Styling    | Tailwind CSS v4 (CSS-first) + the ported design-system CSS   |
| Icons      | `lucide-react`; product/brand marks use the inline sprite    |
| Fonts      | `next/font/google` — Geist + JetBrains Mono                  |
| Auth       | Clerk (`@clerk/nextjs` 7) — `src/proxy.ts` middleware       |
| Data       | Prisma 6 + Postgres (`prisma/schema.prisma`)                 |
| Animation  | Custom CSS + Canvas 2D (no Framer Motion / GSAP)             |

## Layout

```
nextjs/
  prisma/schema.prisma        # User, ApiKey, UsageEvent, TokenRequest
  src/
    proxy.ts                  # Clerk middleware (Next 16 uses proxy.ts)
    app/
      layout.tsx              # metadata, fonts, ClerkProvider, <I18n/>
      page.tsx                # homepage composition
      globals.css             # design system + Tailwind + motion CSS
      site-pages.css          # public secondary pages + docs shell
      sign-in|sign-up/        # Clerk auth routes
      api/
        token-requests/       # POST — landing test-token form
        keys/                 # GET/POST + [id] PATCH/DELETE — protected
      dashboard/              # protected billing/routing/keys/usage views
      download/  docs/
    components/
      SiteMotion.tsx          # reveal, banner stars, ASCII lens, cursor glow, route canvas
      LaunchBanner.tsx  Nav.tsx  Hero.tsx  TrustBand.tsx
      TokenRequest.tsx  TelegramCta.tsx
      Pricing.tsx  QuickStart.tsx  LiveDiscounts.tsx  Faq.tsx  TopUpModal.tsx
      Sections.tsx            # stat bar, features, duo, tier, leaderboard, CTA, footer
      dashboard/  docs/
    lib/
      data.ts  dashboard-data.ts  i18n-data.ts  icons.tsx  site.ts
    server/
      db.ts                   # lazy Prisma client + demo-data fallback
      auth.ts                 # Clerk account mirroring
      repositories.ts         # keys / usage / token requests
  public/assets/              # local images (no hotlinking)
```

## Notes

- **Homepage** is trust-first: a proof band (real upstreams, model fingerprints,
  public list pricing, no silent downgrades), a working pricing table whose
  “See all model prices / Show less” toggle reveals the full catalogue, a free
  test-token form and the Telegram contact CTA (`https://t.me/aigiare`).
- **Pricing toggle**: every model row is rendered once and the controls toggle a
  class (`row-hidden` on the static build, `rows` state in React), so the
  show-all/show-less state can never be clobbered by a re-render.
- The pricing form on the standalone `index.html` validates and confirms in the
  browser (no server there); the Next.js `TokenRequest` posts to
  `/api/token-requests` for real persistence.
- Tailwind `preflight` is disabled so the ported design system keeps its own
  reset; v4 is configured CSS-first with the legacy `tailwind.config.ts` loaded
  via `@config`.
- `DATABASE_URL` may be absent: `src/server/db.ts` creates the Prisma client
  lazily and every repository returns demo data instead of throwing.
- The **dashboard reads from the repositories**: `src/app/dashboard/{page,usage,api-keys}`
  are async server components that call `src/server/dashboard.ts` (API keys,
  usage summary/series, billing rows) and pass the data into the client views.
  Create/revoke on API keys goes through `/api/keys`. Routing, budgets, members
  and purchase history stay demo content — they have no tables in the schema yet.
- Motion is disabled automatically under `prefers-reduced-motion`.
