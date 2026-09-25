import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { createApiKey, listApiKeys } from "@/server/repositories";

export async function GET() {
  try {
    const account = await requireAccount();
    return NextResponse.json({ keys: await listApiKeys(account.id) });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  let account;
  try {
    account = await requireAccount();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "invalid_name", message: "Give the key a name (1–60 characters)." },
      { status: 422 },
    );
  }

  const result = await createApiKey(account.id, name);
  // The plaintext key is returned exactly once, at creation.
  return NextResponse.json(result, { status: 201 });
}
