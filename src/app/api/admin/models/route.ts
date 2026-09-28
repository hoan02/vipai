import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { listModelMeta, saveModelMeta } from "@/server/gateway";

export const dynamic = "force-dynamic";

function forbidden(error: unknown) {
  const message = (error as Error).message;
  return NextResponse.json(
    { error: "forbidden", message },
    { status: message === "Not signed in" ? 401 : 403 },
  );
}

export async function GET() {
  let token = "";
  try {
    ({ token } = await requireRoot());
  } catch (error) {
    return forbidden(error);
  }
  try {
    const { items, total } = await listModelMeta(token);
    return NextResponse.json({ total, items });
  } catch (error) {
    return NextResponse.json(
      { error: "list_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

type Body = Record<string, unknown>;

function parse(body: Body) {
  const id = Number(body.id) || 0;
  const modelName = typeof body.modelName === "string" ? body.modelName.trim() : "";
  const description = typeof body.description === "string" ? body.description : "";
  const tags = typeof body.tags === "string" ? body.tags : "";
  const vendorId = Number(body.vendorId) || 0;
  const status = Number(body.status) === 0 ? 0 : 1;
  const nameRule = Number(body.nameRule) || 0;
  return { id, modelName, description, tags, vendorId, status, nameRule };
}

async function upsert(request: Request) {
  let token = "";
  try {
    ({ token } = await requireRoot());
  } catch (error) {
    return forbidden(error);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = parse(body);
  if (!input.modelName) {
    return NextResponse.json({ error: "invalid_name", message: "Model name is required." }, { status: 422 });
  }
  if (input.nameRule < 0 || input.nameRule > 3) {
    return NextResponse.json({ error: "invalid_rule" }, { status: 422 });
  }

  try {
    await saveModelMeta(token, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "save_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}

/** Creates metadata for a model that has none. */
export async function POST(request: Request) {
  return upsert(request);
}

/** Updates an existing metadata row. */
export async function PUT(request: Request) {
  return upsert(request);
}
