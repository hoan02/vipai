import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { runPlayground, type ChatMessage } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/**
 * A single playground completion.
 *
 * The call is proxied rather than made from the browser so the gateway's key
 * never reaches the client. The account's own balance pays for it, which is the
 * point of a playground: it measures what a real request would cost.
 */
export async function POST(request: Request) {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    model?: unknown;
    messages?: unknown;
    temperature?: unknown;
    maxTokens?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) {
    return NextResponse.json(
      { error: "missing_model", message: "Choose a model." },
      { status: 422 },
    );
  }

  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (m): m is { role: string; content: string } =>
            typeof m === "object" &&
            m !== null &&
            typeof (m as { content?: unknown }).content === "string" &&
            ["system", "user", "assistant"].includes((m as { role?: string }).role ?? ""),
        )
        .map((m) => ({
          role: m.role as ChatMessage["role"],
          content: m.content,
        }))
    : [];

  if (messages.length === 0 || !messages.some((m) => m.role === "user")) {
    return NextResponse.json(
      { error: "missing_messages", message: "Send at least one message." },
      { status: 422 },
    );
  }

  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? Math.min(2, Math.max(0, body.temperature))
      : undefined;
  const maxTokens =
    typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)
      ? Math.min(4096, Math.max(1, Math.floor(body.maxTokens)))
      : undefined;

  try {
    const result = await runPlayground(token, { model, messages, temperature, maxTokens });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "chat_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
