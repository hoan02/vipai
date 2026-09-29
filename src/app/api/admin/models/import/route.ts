import { NextResponse } from "next/server";
import { importModelMeta, requireRoot } from "@/server/admin";

export const dynamic = "force-dynamic";

/**
 * Merges a pasted `vipai.meta` map into the gateway option.
 *
 * Body: `{ meta: "<json>" }`, the same shape the admin Models page shows. Root
 * only, like the rest of the admin surface.
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
    const merged = await importModelMeta(token, body.meta);
    return NextResponse.json({ ok: true, merged });
  } catch (error) {
    return NextResponse.json(
      { error: "import_failed", message: (error as Error).message },
      { status: 422 },
    );
  }
}
