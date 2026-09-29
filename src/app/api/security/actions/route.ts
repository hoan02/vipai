import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import {
  beginPasskeyRegistration,
  deleteAccount,
  deletePasskey,
  finishPasskeyRegistration,
  generateAccessToken,
  regenerateBackupCodes,
  revokeAccessToken,
  revokeOtherSessions,
  revokeSession,
  unbindOAuth,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/**
 * Security actions that are not 2FA.
 *
 * `action` selects the operation so the whole screen shares one route, which
 * keeps the security surface in one file rather than many near-identical ones.
 * Actions the gateway guards return a scoped security proof, so the caller
 * supplies its password once for those.
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

  try {
    switch (action) {
      case "revoke-session": {
        const sid = typeof body.sid === "string" ? body.sid : "";
        if (!sid) {
          return NextResponse.json({ error: "missing_sid" }, { status: 422 });
        }
        await revokeSession(token, sid);
        return NextResponse.json({ ok: true });
      }

      case "revoke-others": {
        await revokeOtherSessions(token);
        return NextResponse.json({ ok: true });
      }

      case "generate-access-token": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        const value = await generateAccessToken(token, password);
        return NextResponse.json({ ok: true, token: value });
      }

      case "revoke-access-token": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        await revokeAccessToken(token, password);
        return NextResponse.json({ ok: true });
      }

      case "regenerate-backup-codes": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        const codes = await regenerateBackupCodes(token, password);
        return NextResponse.json({ ok: true, backupCodes: codes });
      }

      case "passkey-register-begin": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        const begin = await beginPasskeyRegistration(token, password);
        return NextResponse.json({ ok: true, ...begin });
      }

      case "passkey-register-finish": {
        const flowToken = typeof body.flowToken === "string" ? body.flowToken : "";
        const credential =
          body.credential && typeof body.credential === "object"
            ? (body.credential as Record<string, unknown>)
            : null;
        if (!flowToken || !credential) {
          return NextResponse.json({ error: "missing_credential" }, { status: 422 });
        }
        await finishPasskeyRegistration(token, flowToken, credential);
        return NextResponse.json({ ok: true });
      }

      case "passkey-delete": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        await deletePasskey(token, password);
        return NextResponse.json({ ok: true });
      }

      case "unbind-oauth": {
        const providerId = Number(body.providerId);
        if (!password || !Number.isInteger(providerId)) {
          return NextResponse.json({ error: "missing_fields" }, { status: 422 });
        }
        await unbindOAuth(token, providerId, password);
        return NextResponse.json({ ok: true });
      }

      case "delete-account": {
        if (!password) {
          return NextResponse.json({ error: "missing_password" }, { status: 422 });
        }
        await deleteAccount(token, password);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 422 });
    }
  } catch (error) {
    const message = (error as Error).message;
    const status = /password|verif|credential/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: "action_failed", message }, { status });
  }
}
