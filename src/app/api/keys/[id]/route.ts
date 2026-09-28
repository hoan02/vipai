import { NextResponse } from "next/server";
import { GatewayError } from "@/server/gateway";
import { requireAccount } from "@/server/auth";
import { toViewKey } from "@/server/dashboard";
import { revokeApiKey, updateApiKey } from "@/server/repositories";

type Params = { params: Promise<{ id: string }> };

/**
 * Revokes an API key permanently.
 *
 * The backend deletes the row, so this cannot be undone. Use PATCH to disable a
 * key temporarily instead.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAccount();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await revokeApiKey(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "revoke_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/**
 * Enabling or disabling a key.
 *
 * Kept as a route so a caller gets a specific answer instead of a 404, but the
 * gateway has no such operation: see `setTokenEnabled` for what was tried and
 * what the API actually does.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAccount();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  try {
    const record = await updateApiKey(id, { enabled: body.enabled });
    return NextResponse.json({ key: toViewKey(record) });
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 502;
    return NextResponse.json(
      { error: "update_unsupported", message: (error as Error).message },
      { status },
    );
  }
}
