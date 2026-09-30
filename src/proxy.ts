import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localePath, routing, splitLocale } from "@/i18n/routing";

const intl = createMiddleware(routing);

/** Surfaces that carry no locale: the API and the OAuth callback. Sitemap and
 *  robots are already excluded by the matcher, which skips anything with a file
 *  extension. */
const LOCALE_NEUTRAL = ["/api/", "/oauth/"];

/** Routes that require a session. Matched against the path with its locale
 *  prefix removed, so `/vi/dashboard` gates exactly like `/dashboard`. */
const protectedRoutes = ["/dashboard", "/admin", "/api/keys", "/api/admin"];

function isLocaleNeutral(path: string): boolean {
  return LOCALE_NEUTRAL.some((prefix) => path === prefix || path.startsWith(prefix));
}

/**
 * The single network boundary: auth gating and locale routing.
 *
 * Order matters. The gate and the two redirects reason about the path *without*
 * its locale prefix, because `/vi/dashboard` and `/dashboard` are the same
 * surface. next-intl's middleware runs last, and only for the paths that have a
 * locale — handing it `/api/keys` would rewrite it to `/en/api/keys` and 404.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);

  // Compatibility: the standalone sign-in/sign-up pages were folded into the
  // auth dialog. Old links and bookmarks land here and are forwarded to the
  // home page with the right panel, keeping any `redirect_url` they carried —
  // and landing on the same language they arrived in.
  const legacyAuth =
    path === "/sign-in" || path.startsWith("/sign-in/")
      ? "signin"
      : path === "/sign-up" || path.startsWith("/sign-up/")
        ? "signup"
        : null;
  if (legacyAuth) {
    const authUrl = new URL(`${localePath(locale, "/")}`, request.url);
    authUrl.searchParams.set("auth", legacyAuth);
    const redirectTo = request.nextUrl.searchParams.get("redirect_url");
    if (redirectTo) authUrl.searchParams.set("redirect_url", redirectTo);
    return NextResponse.redirect(authUrl);
  }

  // Documentation is English-only. Every other locale's docs URL is sent to the
  // English one rather than serving the same English prose under a second URL,
  // which would publish a duplicate. `localePath` keeps the target correct when
  // the default locale flips.
  if (locale !== "en" && (path === "/docs" || path.startsWith("/docs/"))) {
    return NextResponse.redirect(new URL(localePath("en", path) + search, request.url), 308);
  }

  if (protectedRoutes.some((route) => path.startsWith(route))) {
    // Coarse gate: the cookie is signed and verified where it is read, but a
    // presence check here is enough to send a signed-out visitor to the auth
    // dialog without doing crypto in the proxy.
    const sessionCookie = request.cookies.get("vipai_session")?.value;
    const authHeader = request.headers.get("authorization");

    if (!sessionCookie && !authHeader) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      // There is no sign-in page: the dialog lives in the root layout, so a
      // signed-out visitor goes home with the panel and the return path encoded
      // in the query string, and AuthModal opens itself on arrival.
      const authUrl = new URL(localePath(locale, "/"), request.url);
      authUrl.searchParams.set("auth", "signin");
      // Locale-neutral on purpose: AuthModal navigates with the locale-aware
      // router, so a prefixed value here would be prefixed a second time.
      authUrl.searchParams.set("redirect_url", `${path}${search}`);
      return NextResponse.redirect(authUrl);
    }
  }

  if (isLocaleNeutral(path)) return NextResponse.next();

  // Locale negotiation, prefix redirects and the internal rewrite that lets
  // `app/[locale]` serve an unprefixed default-locale URL.
  return intl(request);
}

export const config = {
  matcher: [
    // Skip Next internals, static files and the generated metadata routes.
    "/((?!_next|_vercel|opengraph-image|twitter-image|sitemap\\.xml|robots\\.txt|icon|apple-icon|manifest\\.webmanifest|[^?]*\\.(?:html?|css|js(?!on)|mjs|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest)).*)",
  ],
};
