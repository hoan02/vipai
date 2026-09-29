import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/admin", "/api/keys", "/api/admin"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Compatibility: the standalone sign-in/sign-up pages were folded into the
  // auth dialog. Old links and bookmarks land here and are forwarded to the
  // home page with the right panel, keeping any `redirect_url` they carried.
  const legacyAuth =
    pathname === "/sign-in" || pathname.startsWith("/sign-in/")
      ? "signin"
      : pathname === "/sign-up" || pathname.startsWith("/sign-up/")
        ? "signup"
        : null;
  if (legacyAuth) {
    const authUrl = new URL("/", request.url);
    authUrl.searchParams.set("auth", legacyAuth);
    const redirectTo = request.nextUrl.searchParams.get("redirect_url");
    if (redirectTo) authUrl.searchParams.set("redirect_url", redirectTo);
    return NextResponse.redirect(authUrl);
  }

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Coarse gate: the cookie is signed and verified where it is read, but a
  // presence check here is enough to send a signed-out visitor to the auth
  // dialog without doing crypto in middleware.
  const sessionCookie = request.cookies.get("vipai_session")?.value;
  const authHeader = request.headers.get("authorization");

  if (!sessionCookie && !authHeader) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // There is no sign-in page: the dialog lives in the root layout, so a
    // signed-out visitor goes home with the panel and the return path encoded
    // in the query string, and AuthModal opens itself on arrival.
    const authUrl = new URL("/", request.url);
    authUrl.searchParams.set("auth", "signin");
    authUrl.searchParams.set("redirect_url", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|mjs|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
