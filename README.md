# VipAI — Next.js 16 app

The VipAI marketing, docs and dashboard front end:
**Next.js 16 App Router + TypeScript + plain CSS + `lucide-react`**, with
the ported design system.

## Architecture

This app holds **no database of its own**. Everything behind it lives in the
new-api gateway, which has its own hostname:

| Concern | Owner |
| :--- | :--- |
| Sign-up, sign-in, sessions | gateway's `/api/user/*`, proxied by this app's `/api/session/*` |
| API keys, quota, billing | gateway's `/api/token/*`, `/api/user/self`, `/api/log/*` |
| Relay API (`/v1/...`) | gateway |
| Marketing pages, docs, dashboard UI | this app |

The gateway needs its own hostname rather than a path prefix: its console is a
single-page app whose HTML hardcodes `/static/js/...` and whose 251 API call
sites are all `/api/...` at the root. Mounted under a prefix the console's HTML
loads and every asset 404s.

### Why the session is held here

The browser never talks to the gateway for auth. Two findings forced that:

- The gateway's cookies do not authenticate its API. `new_api_has_session` and
  `new_api_refresh` are SameSite=Strict, host-only, and a request carrying both
  still answers 401 on `/api/user/self`. Only a bearer token works.
- Its access token lives 15 minutes and is renewed by a refresh token, and its
  CORS cannot be used from a browser: it answers `Access-Control-Allow-Origin: *`
  together with `Access-Control-Allow-Credentials: true`, a combination browsers
  reject.

So `src/server/session.ts` issues a signed HttpOnly cookie holding both tokens,
`src/server/gateway.ts` renews the access token when it is close to expiry, and
`src/lib/auth-client.ts` is a small store over this app's `/api/session` routes.
`SESSION_SECRET` signs that cookie and must be set; there is no default, because
a value that changed across restarts would silently sign everyone out.

## Run locally

```bash
npm install
cp .env.example .env.local     # point BACKEND_API_URL at a running gateway
npm run dev                    # http://localhost:3000
```

`BACKEND_API_URL` points straight at the gateway container, not at Caddy. Caddy
routes by Host header, and a server-side call carries the service name as its
host, so going through it would fall through to this app and answer with HTML.

All three settings the app reads — `BACKEND_API_URL`, `SESSION_SECRET` and
`NEW_API_SERVICE_TOKEN` — are read at runtime. There is no `NEXT_PUBLIC_*`
variable: the browser never calls the gateway directly, so nothing about it
belongs in the client bundle.

`NEW_API_SERVICE_TOKEN` is a root access token used for one read: the per-model
presentation (display name, context, featured flag and the provider list price
behind the discount), which the gateway keeps in its own `vipai.meta` option.
Without it, or before that option is written, a model shows under its own id with
no discount — the gateway is the only source.

`npm run check:backend-url` asserts which backend URLs the validator accepts and
which it refuses.

## Deploy

The image and compose definitions live in a separate private repository,
`hoan02/vipai-deploy`:

- `deploy/agr-fe/Dockerfile` — multi-stage, non-root, Next.js `standalone`
- `deploy/docker-compose.web.yml` — this app, on the shared compose network
- `deploy/Caddyfile` — routes the gateway's hostname to new-api and this app's to here

`output: "standalone"` in `next.config.mjs` is required by that Dockerfile.
Removing it makes the image build fail, because `.next/standalone` is what the
runtime stage copies.

### Continuous deploy

`.github/workflows/deploy-web.yml` runs on a self-hosted runner installed on the
k3s node itself (VM 104). On every push to `main` — or on demand via
*workflow_dispatch* — it builds the image on that host, imports it into k3s'
containerd, and restarts the `web` Deployment. There is no registry: the runner
sits next to the cluster, so the image never leaves the node.

The Dockerfile and `.dockerignore` are owned by the deployment, not this repo.
The job copies them from `/opt/vipai/agr-fe/` on the node into the checked-out
source before building — the same files the manual build uses. Point it elsewhere
by setting the `DOCKERFILE_DIR` repository variable.

Install the runner once per node from the deploy repository:

```bash
deploy/vm/install-runner.sh https://github.com/hoan02/vipai /path/to/token vipai
```

It must run as `hoan`, who is in the `docker` group and holds passwordless sudo
for `k3s`. Both are what the workflow's steps call.

## Stack

| Layer | Choice |
| :--- | --- |
| Framework | Next.js 16 App Router (`src/app/`), React 19 |
| Language | TypeScript |
| Styling | Plain CSS — tokens + design system in `globals.css`, route-scoped stylesheets per section |
| Icons | `lucide-react`; provider marks use the inline sprite, the VipAI logo is the `brandMark` image (`/assets/logo.webp`) |
| Fonts | `next/font/local` — Geist + JetBrains Mono, self-hosted in `src/app/fonts/` (a build-time Google Fonts fetch is unreliable inside the deploy container) |
| Auth client | `src/lib/auth-client.ts` — a store over this app's `/api/session` routes |
| Data | fetch only; no ORM, no database driver |
| Animation | Custom CSS + Canvas 2D (no Framer Motion / GSAP) |
| Charts | `recharts` — the model-analytics page (`/dashboard/models`) |

## Layout

```text
agr-fe/
  next.config.mjs           # output: "standalone" is required by the Dockerfile
  scripts/                  # dev launcher
  src/
    app/
      layout.tsx            # metadata, fonts, <I18n/>
      page.tsx              # homepage composition
      globals.css           # entry: @imports src/styles/index.css
      site-pages.css        # download page
      sign-in|sign-up/      # auth entry points
      api/
        admin/              # GET gateway, PUT pricing, PATCH channels (root only)
        analytics/          # GET the model-analytics window from the quota rollup
        keys/               # GET/POST + [id] PATCH/DELETE
        session/            # login/register/logout + current user
      dashboard/            # api-keys, usage, models, logs, wallet, profile, security
      download/  docs/
    styles/                 # split global CSS; import order === cascade order
      index.css             # the manifest — read this first
      base/                 # foundation, reveal, responsive, motion
      layout/               # chrome (banner + nav + user button), footer
      home/                 # hero, sections, features, pricing, finale
      components/           # route graph, auth modal
      overrides.css         # reference-ground / parity tuning layers
    components/
      site/                 # homepage + marketing chrome
        Nav.tsx  Hero.tsx  LaunchBanner.tsx  SiteMotion.tsx  I18n.tsx
        Sections.tsx        # stat bar, features, duo, tier, leaderboard, CTA, footer
        Pricing.tsx  QuickStart.tsx  LiveDiscounts.tsx  Faq.tsx
        AuthModal.tsx  TelegramCta.tsx  RouteDecisionGraph.tsx
        TopUpModal.tsx  download-platforms.tsx
      UserButton.tsx        # shared by nav, dashboard and admin
      dashboard/  docs/  admin/
    lib/
      auth-client.ts        # session store, over /api/session
      analytics.ts          # model-analytics rollup, bucketing and chart preferences
      dashboard-data.ts  i18n-data.ts  icons.tsx  site.ts
    server/
      http.ts               # backend URL resolution and validation
      session.ts            # the signed session cookie, and token renewal
      gateway.ts            # the new-api client
      repositories.ts       # keys and usage, mapped to the view shapes
      auth.ts  dashboard.ts
  public/assets/            # local images (no hotlinking)
```

## Notes

- **`src/server/http.ts` validates the backend URL.** HTTPS is required unless
  the host is loopback, in a private range, or a known compose service name,
  because a server-side render legitimately reaches the gateway over plain HTTP
  inside the network. A public hostname over HTTP is refused.
- **The gateway is addressed directly as `new-api:3000`**, not through Caddy.
  Caddy routes by Host header, and this request's host is the service name, so a
  call through it would fall through to this app and answer with HTML.
- **A key cannot be disabled, only revoked.** `status` is not writable through
  `PUT /api/token/`, and targeting a key with `/api/token/batch` deletes it. The
  API's only state change is deletion, so the dashboard exposes only Revoke.
- **CSS import order is the cascade.** `src/styles/index.css` reproduces the
  order of the old single-file stylesheet. The override layers at the bottom
  (`base/responsive.css`, `base/motion.css`, `overrides.css`,
  `home/pricing-expand.css`) intentionally tune rules declared above them, so a
  new file must be placed to preserve that order — not alphabetically.
- Motion is disabled automatically under `prefers-reduced-motion`.
- **The pricing table is fed by the gateway.** `src/server/pricing.ts` builds
  every row, price and discount from the gateway: the public `/api/pricing` for
  the models and what they cost, and the `vipai.meta` option (read with
  `NEW_API_SERVICE_TOKEN`) for the display name, context window, featured flag
  and the provider list price the discount is measured against. `src/lib/data.ts`
  now holds only the vendor marks and the static marketing copy.
