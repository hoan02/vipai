import { NextResponse } from "next/server";
import { GatewayError, startOAuth } from "@/server/gateway";
import { publicOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

/**
 * Starts a social sign-in by returning the provider's authorize URL.
 *
 * The browser cannot build this itself: the one-time state token comes from the
 * gateway, and the client never talks to the gateway directly.
 */
export async function GET(request: Request, { params }: Params) {
  const { provider } = await params;
  const redirectUri = `${publicOrigin(request)}/oauth/${provider}`;

  try {
    const url = await startOAuth(provider, redirectUri);
    return NextResponse.json({ url });
  } catch (error) {
    const gatewayStatus = error instanceof GatewayError ? error.status : 502;
    return NextResponse.json(
      { error: "social_start_failed", message: (error as Error).message },
      { status: gatewayStatus === 429 ? 429 : 502 },
    );
  }
}
