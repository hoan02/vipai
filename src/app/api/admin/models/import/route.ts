import { NextResponse } from "next/server";
import { importModelData, requireRoot } from "@/server/admin";

export const dynamic = "force-dynamic";

/**
 * Merges a pasted map into the gateway options.
 *
 * Body: `{ meta: "<json>" }`, the shape the admin Models page shows: per model
 * `name`, `ctx`, `featured`, the list price as `in`/`out`, and optionally
 * `costIn`/`costOut`/`margin`. Root only, like the rest of the admin surface.
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

  let body: { meta?: unknown };
  try {
    body = (await request.json()) as { meta?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.meta !== "string" || !body.meta.trim()) {
    return NextResponse.json(
      { error: "invalid_body", message: "Paste some JSON first." },
      { status: 422 },
    );
  }

  try {
    const { meta, cost } = await importModelData(token, body.meta);
    return NextResponse.json({ ok: true, meta, cost });
  } catch (error) {
    return NextResponse.json(
      { error: "import_failed", message: (error as Error).message },
      { status: 422 },
    );
  }
}
