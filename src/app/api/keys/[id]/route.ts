import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { setApiKeyRevoked } from "@/server/repositories";

type Params = { params: Promise<{ id: string }> };

async function handler(request: Request, { params }: Params) {
  let account;
  try {
    account = await requireAccount();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (request.method === "DELETE") {
    const record = await setApiKeyRevoked(account.id, id, true);
    return record ? NextResponse.json({ key: record }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const revoked = body.revoked !== false;
  const record = await setApiKeyRevoked(account.id, id, revoked);
  return record ? NextResponse.json({ key: record }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export const PATCH = handler;
export const DELETE = handler;
