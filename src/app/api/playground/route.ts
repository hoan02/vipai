import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import {
  runPlayground,
  streamPlayground,
  type ChatMessage,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

/**
 * A single playground completion.
 *
 * The call is proxied rather than made from the browser so the gateway's key
 * never reaches the client. The account's own balance pays for it, which is the
 * point of a playground: it measures what a real request would cost.
 *
 * With `stream: true` the reply is forwarded as Server-Sent Events instead of
 * one JSON body. The frames are the project's own small protocol — `delta`
 * while tokens arrive, then `done` with usage, or `error` — rather than a raw
 * pass-through of the relay's OpenAI chunks, so the client does not have to
 * know the upstream shape.
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
    stream?: unknown;
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

  const options = { model, messages, temperature, maxTokens };

  if (body.stream === true) {
    const encoder = new TextEncoder();
    const frame = (payload: unknown) =>
      encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
    let abort: AbortController | null = null;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        abort = new AbortController();
        try {
          for await (const event of streamPlayground(token, {
            ...options,
            signal: abort.signal,
          })) {
            controller.enqueue(frame(event));
          }
        } catch (error) {
          // A client that already left cannot receive the frame; ignore that.
          try {
            controller.enqueue(frame({ error: (error as Error).message }));
          } catch {
            /* nothing to do */
          }
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed or cancelled */
          }
        }
      },
      cancel() {
        abort?.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // Stops a reverse proxy from buffering the stream into one blob.
        "x-accel-buffering": "no",
      },
    });
  }

  try {
    const result = await runPlayground(token, options);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "chat_failed", message: (error as Error).message },
      { status: 502 },
    );
  }
}
