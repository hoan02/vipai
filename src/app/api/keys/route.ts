import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { toViewKey } from "@/server/dashboard";
import { createApiKey, listApiKeys } from "@/server/repositories";

// Limen's api-key plugin accepts names of 3 to 100 characters. Validating the
// same range here keeps the error message specific instead of surfacing the
// plugin's generic validation response.
const NAME_MIN = 3;
const NAME_MAX = 100;

export async function GET() {
  try {
    await requireAccount();
    return NextResponse.json({ keys: (await listApiKeys()).map(toViewKey) });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAccount();
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
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return NextResponse.json(
      {
        error: "invalid_name",
        message: `Give the key a name (${NAME_MIN}–${NAME_MAX} characters).`,
      },
      { status: 422 },
    );
  }

  try {
    // The plaintext key is returned exactly once, at creation.
    const { record, plaintextKey } = await createApiKey(name);
    return NextResponse.json({ key: plaintextKey, record: toViewKey(record) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "create_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
