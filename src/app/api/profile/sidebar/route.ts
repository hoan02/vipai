import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { updateSidebarModules } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/** Stores the sidebar-module preferences. Body: `{ modules: string }`. */
export async function PUT(request: Request) {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { modules?: unknown };
  try {
    body = (await request.json()) as { modules?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.modules !== "string" || !body.modules.trim()) {
    return NextResponse.json(
      { error: "invalid_modules", message: "No sidebar configuration was sent." },
      { status: 422 },
    );
  }

  // Reject anything that is not a JSON object, so a malformed payload cannot
  // replace the stored setting with junk.
  try {
    const parsed = JSON.parse(body.modules) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
  } catch {
    return NextResponse.json(
      { error: "invalid_modules", message: "The sidebar configuration is malformed." },
      { status: 422 },
    );
  }

  try {
    await updateSidebarModules(token, body.modules);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "sidebar_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
