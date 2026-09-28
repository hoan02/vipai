import { NextResponse } from "next/server";
import { requireRoot, setModelPrices, type ModelPrice } from "@/server/admin";

export const dynamic = "force-dynamic";

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Saves prices as ratios.
 *
 * Body: `{ models: [{ id, input, output, cache }] }`, all in USD per 1M
 * tokens. `cache` may be null to leave the cache rate untouched.
 */
export async function PUT(request: Request) {
  let token = "";
  try {
    ({ token } = await requireRoot());
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { error: "forbidden", message },
      { status: message === "Not signed in" ? 401 : 403 },
    );
  }

  let body: { models?: unknown };
  try {
    body = (await request.json()) as { models?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.models)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  const entries: ModelPrice[] = [];
  for (const raw of body.models as Array<Record<string, unknown>>) {
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    const input = parseNumber(raw?.input);
    const output = parseNumber(raw?.output);
    if (!id || input === null || input <= 0 || output === null || output <= 0) {
      return NextResponse.json(
        { error: "invalid_price", message: `Model ${id || "(unnamed)"} needs a positive input and output price.` },
        { status: 422 },
      );
    }
    entries.push({ id, input, output, cache: parseNumber(raw?.cache) });
  }

  try {
    await setModelPrices(token, entries);
    return NextResponse.json({ ok: true, updated: entries.length });
  } catch (error) {
    return NextResponse.json(
      { error: "save_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
