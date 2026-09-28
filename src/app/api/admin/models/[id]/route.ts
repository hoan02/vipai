import { NextResponse } from "next/server";
import { requireRoot } from "@/server/admin";
import { deleteModelMeta } from "@/server/gateway";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
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

  const { id } = await params;
  const modelId = Number(id);
  if (!Number.isInteger(modelId) || modelId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 422 });
  }

  try {
    await deleteModelMeta(token, modelId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "delete_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
