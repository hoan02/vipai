import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeOAuth, persistSession } from "@/server/gateway";
import { publicOrigin } from "@/server/http";
import { isLocale, localePath, LOCALE_COOKIE, routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

/**
 * The provider redirects here after the visitor consents.
 *
 * The code is exchanged server-side, the session is stored in this app's own
 * cookie and the visitor lands on the dashboard. A failure goes home with the
 * auth dialog open and a marker the dialog turns into a message.
 *
 * The URL must match the redirect URI Google has registered, which the gateway
 * also recomputes from its Server Address at exchange time — see `startOAuth`.
 */
export async function GET(request: Request, { params }: Params) {
  const { provider } = await params;
  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  const denied = incoming.searchParams.get("error");
  const origin = publicOrigin(request);

  // The callback URL is registered with the provider, so the locale cannot ride
  // along in it. The cookie next-intl already wrote is the next best signal.
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : routing.defaultLocale;

  const fail = (reason: string) => {
    const target = new URL(localePath(locale, "/"), origin);
    target.searchParams.set("auth", "signin");
    target.searchParams.set("oauth_error", reason);
    return NextResponse.redirect(target);
  };

  if (denied) return fail(denied);
  if (!code || !state) return fail("missing_code");

  try {
    const session = await completeOAuth(provider, code, state);
    await persistSession(session);
    return NextResponse.redirect(new URL(localePath(locale, "/dashboard"), origin));
  } catch (error) {
    console.error("[vipai] oauth callback failed:", error);
    return fail("oauth_failed");
  }
}
