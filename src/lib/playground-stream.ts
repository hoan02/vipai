"use client";

/**
 * Client side of the playground stream.
 *
 * The route answers Server-Sent Events: `delta` frames while the model talks,
 * then one `done` frame with usage, or an `error` frame. `fetch` + a body
 * reader is enough for a POST stream — EventSource only speaks GET — so no SSE
 * library is needed. The `signal` is what the Stop button and an unmounted
 * component use to abandon a reply.
 */

export type PlaygroundMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
};

type StreamEvent =
  | { delta: string }
  | { done: true; model?: string; usage?: { promptTokens?: number; completionTokens?: number } }
  | { error: string };

export async function streamCompletion(
  input: {
    model: string;
    messages: PlaygroundMessage[];
    temperature?: number;
    maxTokens?: number;
  },
  handlers: { onDelta: (text: string) => void; signal?: AbortSignal },
): Promise<StreamUsage> {
  let response: Response;
  try {
    response = await fetch("/api/playground", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, stream: true }),
      signal: handlers.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new Error("Could not reach the server.");
  }

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || "The request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: StreamUsage = { model: input.model, promptTokens: 0, completionTokens: 0 };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const rawFrame of frames) {
        const line = rawFrame.split("\n").find((entry) => entry.startsWith("data:"));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (!data) continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(data) as StreamEvent;
        } catch {
          continue;
        }

        if ("error" in event && typeof event.error === "string") {
          throw new Error(event.error);
        }
        if ("delta" in event && typeof event.delta === "string") {
          handlers.onDelta(event.delta);
        }
        if ("done" in event) {
          usage = {
            model: event.model ?? input.model,
            promptTokens: event.usage?.promptTokens ?? 0,
            completionTokens: event.usage?.completionTokens ?? 0,
          };
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return usage;
}
