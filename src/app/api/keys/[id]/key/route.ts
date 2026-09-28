import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { revealApiKey } from "@/server/repositories";

type Params = { params: Promise<{ id: string }> };

/**
 * Reveals one key's plaintext value.
 *
 * The gateway only parts with a real key through its own reveal route, which the
 * list never exposes. Used by the Overview's "copy a ready-to-run request"
 * action; nothing is cached and the value is not logged.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    await requireAccount();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const key = await revealApiKey(id);
    return NextResponse.json({ key });
  } catch (error) {
    return NextResponse.json(
      { error: "reveal_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
