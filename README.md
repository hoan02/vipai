# AiGiare — Next.js port

Full Next.js (App Router) rebuild of the AiGiare landing page, matching the
reference site's stack: **Next.js App Router + TypeScript + Tailwind CSS +
`lucide-react`**, with the original custom design-system CSS and the canvas
motion layers from `index.html`.

## Run

```bash
cd nextjs
npm install
npm run dev
# http://localhost:3000
```

## Stack

| Layer      | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 16 App Router (`app/`), React 19                    |
| Language   | TypeScript                                                  |
| Styling    | Tailwind CSS v4 (CSS-first) + the ported custom design-system CSS |
| Icons      | `lucide-react` available; product marks use the inline sprite |
| Fonts      | `next/font/google` — Geist + JetBrains Mono                 |
| Animation  | Custom CSS + Canvas 2D (no Framer Motion / GSAP), like the reference |

## Layout

```
nextjs/
  app/
    layout.tsx        # metadata, fonts, globals.css
    page.tsx          # section composition
    globals.css       # design system + Tailwind + motion CSS
  components/
    SiteMotion.tsx    # reveal, banner stars, ASCII lens, cursor glow, route canvas
    LaunchBanner.tsx  Nav.tsx  Hero.tsx
    Pricing.tsx  QuickStart.tsx  LiveDiscounts.tsx  Faq.tsx  TopUpModal.tsx
    Sections.tsx      # stat bar, features, duo, tier, leaderboard, CTA, footer
  lib/
    data.ts           # models, discounts, leaderboard, code snippets, FAQs
    icons.tsx         # SVG sprite + <Icon> helper
  public/assets/      # local images (no hotlinking)
```

## Notes

- Tailwind `preflight` is disabled so the ported design system keeps its own
  reset and the reference styling stays intact. In Tailwind v4 this is done in
  `app/globals.css` by importing `tailwindcss/theme.css` and
  `tailwindcss/utilities.css` directly and omitting `tailwindcss/preflight.css`.
- Tailwind v4 is configured CSS-first, with the legacy `tailwind.config.ts`
  still loaded via the `@config` directive.
- `next lint` was removed in Next.js 16, so there is no `lint` script; add ESLint
  separately if needed.
- Build-time tooling (`tailwindcss`, `@tailwindcss/postcss`, `postcss`,
  `typescript`, `@types/*`) lives in `dependencies` rather than
  `devDependencies`, because the deploy/build environment performs a
  production install (`NODE_ENV=production` / `--omit=dev`) and would otherwise
  strip them before `next build` runs.
- Motion is disabled automatically under `prefers-reduced-motion`.
- Canvas layers live in one client component (`SiteMotion`) that mounts the
  same runtime used by the static `index.html`, keeping the two builds aligned.
