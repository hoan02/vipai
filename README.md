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
| Fonts | `next/font/google` — Geist + JetBrains Mono |
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
      layout.tsx            # metadata (canonical/OG/Twitter), fonts, <I18n/>
      page.tsx              # homepage composition
      sitemap.ts            # /sitemap.xml — core pages + LIVE_PAGES from the docs manifest
      robots.ts             # /robots.txt — allow /, disallow /dashboard /admin /api
      opengraph-image.tsx   # the 1200x630 share card, generated with next/og
      pricing/page.tsx      # the catalogue's own URL: live table + FAQ + ItemList schema
      models/page.tsx       # crawlable hub: every model as a link
      models/[id]/page.tsx  # one landing page per model, Product schema, price vs list
      about/page.tsx        # who is behind it (E-E-A-T), Organization schema
      legal/privacy|terms/  # the policy pages the footer links to
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
      seo.ts                # SITE_URL, the shared OG fields and pageMeta()
      schema.ts             # JSON-LD builders (Organization, Product, FAQPage, …)
    server/
      http.ts               # backend URL resolution and validation
      session.ts            # the signed session cookie, and token renewal
      gateway.ts            # the new-api client
      repositories.ts       # keys and usage, mapped to the view shapes
      auth.ts  dashboard.ts
  public/assets/            # local images (no hotlinking)
```

## Internationalization (in progress)

The site is migrating from a client-side DOM sweep (`I18n.tsx`, a 719-entry
sentence-keyed dictionary in `i18n-data.ts`, locale in `localStorage`) to
URL-based locales rendered on the server. The old approach cannot rank
Vietnamese: one URL served one HTML, and that HTML was English.

Target, once the migration completes:

| Path | Locale |
| :--- | :--- |
| `/`, `/pricing`, `/models/*`, `/about`, `/download`, `/legal/*`, `/dashboard/*` | Vietnamese |
| `/en`, `/en/pricing`, `/en/models/*`, … | English |
| `/docs/*` | **301 → `/en/docs/*`** — documentation stays English |
| `/api/*`, `/sitemap.xml`, `/robots.txt`, `/opengraph-image` | locale-neutral |

Order matters, and it is chosen so nothing indexed moves until the last step:

| Step | Work | Effect on the live site |
| :--- | :--- | :--- |
| **0 — done** | `next-intl`, `src/i18n/{routing,request,navigation}.ts`, plugin in `next.config.mjs`, `pageMeta()` takes an hreflang map, `messages/{en,vi}.json` seeded | none (inert) |
| **1 — done** | Route tree moved under `app/[locale]/`, `next/link` → the locale-aware `Link` (18 files), `src/proxy.ts` composes next-intl with the auth gate, `<html lang>` and the language switcher now read the URL | **adds `/vi`; breaks nothing** — the default locale is still `en`, so no indexed URL moved |
| **2 — in progress** | Convert components to `useTranslations` with semantic keys, delete the DOM sweep | `/vi` fills in with server-rendered Vietnamese |
| **3 — in progress** | Per-locale metadata, JSON-LD `inLanguage`, hreflang, self-canonical, sitemap alternates | the two translated pages become indexable in both locales |
| **4** | Flip `defaultLocale` to `vi`, add the `/docs/*` redirects | the one URL-breaking step |
| **5** | Translate documentation, one page at a time | adds `/vi/docs/*` |

What step 1 established, in the code:

- **The URL is the locale.** `localStorage` is gone; the switcher in `Nav` calls
  `router.replace(pathname, { locale })` and `I18n.tsx` reads its locale from
  next-intl. `documentElement.lang` is server-rendered from the URL segment.
- **`/vi` is `noindex` for now.** The layout sets `robots` per locale, because
  until step 2 the Vietnamese pages render the same English strings and
  indexing them would publish a duplicate. Step 3 flips each page as its copy
  is translated.
- **Documentation is English-only**, so `/vi/docs/*` answers `308` to `/docs/*`
  rather than serving the same prose under a second URL. Links stay
  locale-neutral and take that hop; `next-intl` cannot express "link to English
  without a prefix" — passing an explicit `locale` sets `forcePrefix`, which
  renders `/en/docs` and redirects the other way.
- **`alternateLinks: false` and `localeDetection: false`.** The middleware's
  automatic `Link` header advertised `/vi/docs` (a redirect) and every `/vi`
  page (noindex), so hreflang waits for step 3, where each page knows which
  locales it actually exists in. No auto-redirect keeps both locales crawlable
  and a shared link showing what the sender saw.
- **The share card is a static `public/og.png`, not `app/opengraph-image.tsx`.**
  The file convention has to sit at `app/` to serve an unprefixed URL, and
  everything at `app/` is inherited by the generated `_not-found` route, which
  has no metadataBase — a warning on every build. It lives in `BASE_OPEN_GRAPH`
  so a page that overrides `openGraph` cannot drop it.
- **The auth bounce is locale-aware and the return path is not.** `proxy.ts` and
  `requireAccountOrRedirect` send a signed-out visitor to `/<locale>?auth=signin`
  but keep `redirect_url` locale-neutral, because `AuthModal` navigates with the
  locale-aware router — a prefixed value there would be prefixed twice.

Two constraints discovered while planning, both of which shape the work:

- **next-intl cannot use `.` in a message key** — it means nesting. The current
  dictionary is keyed by whole English sentences, many containing a period, so
  it cannot be imported as-is: step 2 is a real rename to namespaced keys
  (`home.hero.title`), not a mechanical conversion.
- **`lang` and content must come from the same source.** That is now true of
  `lang`, which is read from the locale param. On the migrated surfaces it is
  also true of the copy; the rest is still rewritten after hydration by
  `I18n.tsx`, from the same URL-derived locale, until step 2 removes it.

### Translating a component (the step-2 recipe)

`messages/{en,vi}.json` is the catalogue. Namespaces are surfaces, leaves are
camelCase and semantic — never a sentence, and never containing a `.`:

```json
{ "nav": { "home": "Home", "getApiKey": "Get API key" } }
```

A component then indexes it by key rather than holding a label:

```tsx
const t = useTranslations("nav");
const links = [{ href: "/pricing", key: "pricing" }];
// <Link href={l.href}>{t(l.key)}</Link>
```

Three rules make a migration verifiable:

1. **A migrated subtree carries `data-i18n-skip`.** Both passes of `I18n.tsx`
   edit the DOM in place, which is only safe while React is not rendering the
   same nodes — the block pass rewrites `innerHTML` and would replace an anchor
   with a bare string. The attribute disappears with the file.
2. **`npm run check:i18n`** fails if any locale is missing a key, because
   next-intl throws at render time otherwise — a 500 on one route in one
   language, not a build error.
3. **Verify against the raw HTML**, not a browser: `curl /vi | grep` proves the
   string was server-rendered, which is the whole point of step 2. A browser
   would be convinced by the DOM sweep instead.

Done so far: every component on the public site — `Nav`, `LaunchBanner`,
`Footer`, `UserButton`, `Hero`, `Pricing`, `Faq`, all nine sections of
`Sections.tsx`, `TelegramCta`, `AuthModal`, `TopUpModal`, `DownloadPlatforms`,
`CommandPalette`, `RouteDecisionGraph` — plus the page prose of `/`, `/pricing`,
`/models`, `/models/<id>`, `/download` and `/about`. 390 keys.

The dashboard's foundation is in: `lib/dashboard-data.ts` carries `labelKey` /
`titleKey` instead of labels, so the sidebar (`dashboard/shell.tsx`) and the
command palette's Dashboard group resolve the same keys. `kit.tsx` needed no
work — it takes every string as a prop.

The **logs cluster** is done: `logs-filter.tsx`, `use-log-page.ts` and the three
views (`usage`, `audit`, `task`). They shared the filter bar, the pager and the
error strip, so those were extracted into `log-pager.tsx` while translating —
the markup was identical three times over, which would have meant writing every
label three times. `logs` is the shared namespace; `logsUsage`, `logsAudit` and
`logsTask` hold what is specific to one section.

`api-keys-view.tsx`, `wallet-view.tsx`, `overview/*`, and
`models-view.tsx`/`models-charts.tsx` are done too.

Two notes from those passes. The subscription duration was built on the server
from a machine unit (`day`/`month`/`year`), so its wording and plural were
unreachable by translation — it now goes through `durationDays` and friends.

The overview's health helpers (`creditHealth`, `runwayLabel`) were pure
functions returning display strings; they now return a key and a figure, and the
component chooses the words. A unit that is a symbol — `ms`, `s`, `t/s`, `%` —
stays literal in `formatLatency`/`formatThroughput`/`formatPercent`, the same as
`GB` or `kHz` would.

`npm run check:i18n` now does two things, because both failure modes used to
surface as a 500 on one route in one language instead of as a build failure: it
compares the key sets across locales, and it **compiles every message** with the
same `intl-messageformat` that formats them at runtime. A malformed plural is
caught in CI rather than behind a login wall the build never renders.

What is left: `chat-view`/`playground-view`, `profile-view`, `security-view`,
the admin tree (whose `admin-shell.tsx` still holds `item.label`), the six
documentation pages, and the two legal pages. Only then can `I18n.tsx` — and the
719-entry dictionary behind it — be deleted.

A second thing the migration keeps finding, beyond missing translations: **the
source language was not consistent.** The homepage was authored in English and
translated down to Vietnamese; `AuthModal` was authored in Vietnamese and
translated up to English through a reversed dictionary. Only four of its strings
were actually in that dictionary, so `useT()` fell through to its `?? viText`
default and English readers were shown Vietnamese. The `auth` namespace is
therefore mostly newly written English, not moved text.

The FAQ is the worked example of content, not just chrome: its questions and
answers were moved out of `lib/data.ts` into the catalogue, so the same list
feeds the accordion and the `FAQPage` structured data in whichever language the
page is served. `lib/faq.ts` holds only the order and the keys.

Two rules the sections settled, both about not embedding a unit in a string:
`RankRow` (`lib/data.ts`) keeps the raw figure and the unit is a message, so
"requests"/"success"/"tokens" translate without duplicating the number per
locale; and a figure that belongs mid-sentence is an ICU parameter
(`{n}`, `{pct}`, `{model}`), never string concatenation.

### Indexing a translated page (the step-3 recipe)

A page becomes indexable in a second locale only when its **content** is
translated, not when its chrome is. Indexing is therefore per page, and it is
opt-in:

1. Call `translatedPageMeta({ locale, path, title, description })` from a
   `generateMetadata`, not a static `metadata` export — a shared object cannot
   know which locale it renders for, and would make the Vietnamese page declare
   the English URL as its canonical, which is how a good translation gets
   dropped from the index. It writes a self-referential canonical, the
   reciprocal hreflang map with `x-default`, and `robots: index`.
2. Add the page to `sitemap.ts` through `translated()` so both locales are listed
   with the same `xhtml:link` pairs the head emits. A sitemap that pairs URLs the
   head does not is a contradiction the crawler has to resolve.
3. Leave everything else alone. The `[locale]/layout.tsx` default is
   `noindex` for a non-default locale, so a page that has not been translated —
   `/about`, `/models`, `/download`, the legal pages — keeps serving English
   under `/vi` without publishing a duplicate.

Indexed so far, in both locales: `/`, `/pricing`, `/models`, `/models/<id>` (every
model), `/download`, `/about`. Still English-only and still `noindex` under `/vi`:
`/legal/privacy`, `/legal/terms`, and the docs tree.

### A string that was never in the catalogue at all

`Model.disc` used to hold `"90% off"`, built on the server in
`src/server/pricing.ts`. Nothing could translate it: the words around the figure
were generated, not authored. The field is gone and only `discPct` remains, so
the UI formats it with `common.discountOff` and the same catalogue that gives the
number its wording in both languages.

The general rule this is an instance of: **if a value is assembled in code, the
words in it are unreachable by translation.** Anything the reader sees has to
originate in `messages/` — a figure, a name or a date can be a parameter, but the
prose around it cannot.

**Warning for step 4.** That layout default is keyed on *which locale is
default*, so flipping the locale inverts the whole tree at once: every English
page would become noindex. Before the flip, each page must state its own
`robots` instead of inheriting one.

Worth knowing before continuing: the old dictionary covered far less than it
looked like it did. The eight FAQ **questions** were translated and the eight
**answers** were not; so were the pricing table's column headers, its empty
states, and the body copy of `Features` and `Duo`. A migration step therefore
adds coverage as often as it renames, and the way to tell is to grep
`i18n-data.ts` for the string before assuming it was already translated.

## Notes

- **SEO lives in `src/lib/seo.ts` plus four file-convention routes.** `seo.ts`
  holds `SITE_URL` and `BASE_OPEN_GRAPH`; `pageMeta(path, title, description)`
  returns the self-canonical and Open Graph for one page. Canonical and OG are
  **not** set on the root layout: Next.js inherits `alternates`/`openGraph` down
  the segment tree, so a value set once would leak onto every child route and
  make every page canonical to the homepage. Each page states its own.
- **`app/opengraph-image.tsx` is deliberate.** File-based metadata overrides the
  `metadata` object, so one generated card serves every route and no page has to
  repeat an `og:image`. It is prerendered (no request-time APIs), so it costs
  nothing at runtime.
- **`<html lang>` is `en`, not `vi`.** The components are authored in English and
  `<I18n/>` rewrites both the copy and `documentElement.lang` after hydration
  (default locale: Vietnamese). A crawler that does not run JavaScript sees the
  English HTML, so labelling it `vi` was a mismatch. Serving Vietnamese *to*
  crawlers needs URL-based locales, which is still open.
- **Cloudflare appends a content-signals block to `/robots.txt`.** It is
  comments only and does not replace this app's rules; `robots.ts` is the source
  of the `Allow`/`Disallow`/`Sitemap` lines.
- **Structured data lives in `src/lib/schema.ts` and is rendered by
  `<JsonLd/>`.** One builder per entity, and every value in a block is something
  the page also shows a reader (the rule that keeps markup honest). Docs pages
  build theirs from the manifest through `<DocJsonLd/>`, so a new docs page needs
  no schema work. `JsonLd` escapes `<` to `\u003c` because the payload goes
  through `dangerouslySetInnerHTML`.
- **`/models/[id]` keys off `modelSlug(id)`, not the raw id.** An id can carry
  brackets (`kimi-k3[1M]`), so the slug is derived and resolved by matching
  `modelSlug` against the catalogue rather than by decoding the URL. The slug
  follows the id, not the display name, so a rename does not move the URL.
- **The legal pages are an engineering draft.** `legal/privacy` and
  `legal/terms` describe how the product actually behaves (no training on
  prompts, credits that do not expire, the model-accuracy refund), but counsel
  must confirm the entity, governing law and retention periods before they are
  relied on.
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
