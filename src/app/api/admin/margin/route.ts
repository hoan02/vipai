import { NextResponse } from "next/server";
import { requireRoot, setMarginConfigs, type MarginConfig } from "@/server/admin";

export const dynamic = "force-dynamic";

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Saves upstream cost and margin per model.
 *
 * Body: `{ models: [{ id, in, out, margin }], apply?: boolean }`, costs in USD
 * per 1M tokens and margin a fraction (0.2 = +20%). With `apply`, retail is set
 * to `cost × (1 + margin)` and pushed to the gateway's ratios.
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

  let body: { models?: unknown; apply?: unknown };
  try {
    body = (await request.json()) as { models?: unknown; apply?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.models)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  const entries: MarginConfig[] = [];
  for (const raw of body.models as Array<Record<string, unknown>>) {
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    const costIn = parseNumber(raw?.in);
    const costOut = parseNumber(raw?.out);
    const margin = parseNumber(raw?.margin);
    if (!id || costIn === null || costOut === null || margin === null || costIn < 0 || costOut < 0 || margin < 0) {
      return NextResponse.json(
        { error: "invalid_margin", message: `Model ${id || "(unnamed)"} needs non-negative cost and margin.` },
        { status: 422 },
      );
    }
    entries.push({ id, in: costIn, out: costOut, margin });
  }

  try {
    await setMarginConfigs(token, entries, body.apply === true);
    return NextResponse.json({ ok: true, updated: entries.length, applied: body.apply === true });
  } catch (error) {
    return NextResponse.json(
      { error: "save_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
