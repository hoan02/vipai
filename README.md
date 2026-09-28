# AiGiare — Next.js 16 app

The AiGiare marketing, docs and dashboard front end:
**Next.js 16 App Router + TypeScript + Tailwind CSS v4 + `lucide-react`**, with
the ported design system.

## Architecture

This app holds **no database** and runs **no auth of its own**. Everything
behind it lives in the new-api gateway:

| Concern | Owner |
| :--- | :--- |
| Sign-up, sign-in, sessions | gateway, under `/_aigiare/auth/*` |
| API keys, quota, billing | gateway |
| Relay API (`/v1/...`) | gateway |
| Marketing pages, docs, dashboard UI | this app |

Caddy fronts both tiers on one hostname, so the gateway is same-origin and the
session cookie needs no cross-origin CORS handling.

The Encore Go backend that previously owned auth and data was retired. The
client in `src/lib/backend-client.ts` is still used as a typed HTTP wrapper, but
it can no longer be regenerated — the generator lived in that project. Treat it
as hand-maintained now, and do not expect `encore gen client` to work.

## Run locally

```bash
npm install
cp .env.example .env.local     # point BACKEND_API_URL at a running gateway
npm run dev                    # http://localhost:3000
```

`BACKEND_API_URL` must point at something serving the gateway. Locally that is
either a gateway on the same machine or a tunnel; `http://localhost:4000` in the
example is the retired Encore port and is only a placeholder for the shape.

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_URL_PATH` are inlined at build time,
so changing them needs a rebuild, not a restart.

## Deploy

The image and compose definitions live in a separate private repository,
`hoan02/aigiare-deploy`:

- `deploy/agr-fe/Dockerfile` — multi-stage, non-root, Next.js `standalone`
- `deploy/docker-compose.web.yml` — this app, on the shared compose network
- `deploy/Caddyfile` — routes `/_aigiare/*` to the gateway and everything else here

`output: "standalone"` in `next.config.mjs` is required by that Dockerfile.
Removing it makes the image build fail, because `.next/standalone` is what the
runtime stage copies.

## Stack

| Layer | Choice |
| :--- | --- |
| Framework | Next.js 16 App Router (`src/app/`), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first) + the ported design-system CSS |
| Icons | `lucide-react`; product/brand marks use the inline sprite |
| Fonts | `next/font/google` — Geist + JetBrains Mono |
| Auth client | `limen-auth` — talks to the gateway, stores no session itself |
| Data | fetch only; no ORM, no database driver |
| Animation | Custom CSS + Canvas 2D (no Framer Motion / GSAP) |

## Layout

```text
agr-fe/
  next.config.mjs           # output: "standalone" is required by the Dockerfile
  scripts/                  # dev launcher
  src/
    app/
      layout.tsx            # metadata, fonts, <I18n/>
      page.tsx              # homepage composition
      globals.css           # design system + Tailwind + motion CSS
      site-pages.css        # public secondary pages + docs shell
      sign-in|sign-up/      # auth entry points
      api/
        token-requests/     # POST — landing test-token form
        keys/               # GET/POST + [id] PATCH/DELETE
      dashboard/            # api-keys, usage, cost, budgets, members, routing
      download/  docs/
    components/
      SiteMotion.tsx        # reveal, banner stars, ASCII lens, cursor glow, route canvas
      LaunchBanner.tsx  Nav.tsx  Hero.tsx  TrustBand.tsx
      AuthModal.tsx  TokenRequest.tsx  TelegramCta.tsx
      Pricing.tsx  QuickStart.tsx  LiveDiscounts.tsx  Faq.tsx  TopUpModal.tsx
      Sections.tsx          # stat bar, features, duo, tier, leaderboard, CTA, footer
      dashboard/  docs/
    lib/
      backend-client.ts     # typed HTTP wrapper for the gateway
      auth-client.ts        # limen-auth, basePath /_aigiare/auth
      dashboard-data.ts  i18n-data.ts  icons.tsx  site.ts
    server/
      http.ts               # backend URL resolution + credential forwarding
      backend.ts            # shared client with the per-request fetcher
      repositories.ts       # api keys, usage, token requests
      auth.ts  dashboard.ts
  public/assets/            # local images (no hotlinking)
```

## Notes

- **`src/server/http.ts` validates the backend URL.** HTTPS is required unless
  the host is loopback or in a private range, because a server-side render may
  legitimately reach a sibling container over plain HTTP. A public hostname over
  HTTP is refused.
- **The gateway is addressed through Caddy**, not as `new-api:3000` directly, so
  a render gets the same prefix routing the browser gets.
- Motion is disabled automatically under `prefers-reduced-motion`.
