import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import {
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/**
 * Two-factor enrolment and teardown.
 *
 * `setup` needs the password to obtain a proof and returns the secret and QR
 * image; `enable` confirms a code from the authenticator; `disable` needs the
 * password again. Keeping them in one route mirrors the gateway's own grouping.
 */
export async function POST(request: Request) {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const flowToken = typeof body.flowToken === "string" ? body.flowToken : "";

  try {
    switch (action) {
      case "setup": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        const setup = await setupTwoFactor(token, password);
        return NextResponse.json({ ok: true, setup });
      }

      case "enable": {
        if (!flowToken || !code) {
          return NextResponse.json({ error: "missing_code" }, { status: 422 });
        }
        await enableTwoFactor(token, flowToken, code);
        return NextResponse.json({ ok: true });
      }

      case "disable": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        await disableTwoFactor(token, password);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 422 });
    }
  } catch (error) {
    const message = (error as Error).message;
    const status = /password|code|verif/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: "twofa_failed", message }, { status });
  }
}
