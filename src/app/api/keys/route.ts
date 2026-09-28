import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { toViewKey } from "@/server/dashboard";
import { createApiKey, listApiKeys, requireAccessToken } from "@/server/repositories";
import { listGroups } from "@/server/gateway";

// The gateway rejects a token name of 60 characters or more, and accepts even a
// single character. Requiring three keeps a name usable in the table without
// being stricter than the backend.
const NAME_MIN = 3;
const NAME_MAX = 50;

export async function GET() {
  try {
    await requireAccount();
    const token = await requireAccessToken();
    const [keys, groups] = await Promise.all([listApiKeys(), listGroups(token)]);
    return NextResponse.json({
      keys: keys.map(toViewKey),
      /** Groups the account may bill under, for the create form. */
      groups: groups.map((group) => group.name),
    });
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

  // Optional limits. Each is normalised here so a malformed value cannot reach
  // the gateway, which would reject the whole request without saying which field.
  const models = Array.isArray(body.models)
    ? body.models.filter((m): m is string => typeof m === "string").map((m) => m.trim()).filter(Boolean)
    : typeof body.models === "string"
      ? body.models.split(",").map((m) => m.trim()).filter(Boolean)
      : [];

  const group = typeof body.group === "string" ? body.group.trim() : "";
  const allowIps = typeof body.allowIps === "string" ? body.allowIps.trim() : "";

  const expiresInDays =
    typeof body.expiresInDays === "number" && Number.isFinite(body.expiresInDays)
      ? Math.max(0, Math.floor(body.expiresInDays))
      : 0;

  try {
    // The plaintext key is returned exactly once, at creation.
    const { record, plaintextKey } = await createApiKey(name, {
      models,
      group,
      allowIps,
      expiresInDays,
    });
    return NextResponse.json({ key: plaintextKey, record: toViewKey(record) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "create_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
