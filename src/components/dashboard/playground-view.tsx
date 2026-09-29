"use client";

import { useRef, useState } from "react";
import { Send, Square, Trash2 } from "lucide-react";
import { StickToBottom } from "use-stick-to-bottom";
import { toast } from "sonner";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { Markdown } from "@/components/markdown";
import { ModelIcon } from "@/components/model-icon";
import { Select } from "@/components/ui/select";
import { streamCompletion, type PlaygroundMessage } from "@/lib/playground-stream";

/**
 * A minimal chat playground.
 *
 * Requests are proxied through this app so the relay key stays on the server.
 * Each call costs the account's balance, which the reply reports back so the
 * price of a prompt is visible rather than a surprise on the usage screen.
 *
 * Replies stream: tokens land in the last bubble as they arrive, the view is
 * pinned to the bottom while they do, and Stop abandons a reply mid-flight.
 */

type ChatMessage = PlaygroundMessage;

export function PlaygroundView({
  models,
  defaultModel,
}: {
  models: string[];
  defaultModel: string;
}) {
  const [model, setModel] = useState(defaultModel);
  const [system, setSystem] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastUsage, setLastUsage] = useState<{
    model: string;
    promptTokens: number;
    completionTokens: number;
  } | null>(null);
  const [temperature, setTemperature] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [modelFilter, setModelFilter] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const visibleModels = modelFilter.trim()
    ? models.filter((m) => m.toLowerCase().includes(modelFilter.trim().toLowerCase()))
    : models;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const thread: ChatMessage[] = [
      ...(system.trim() ? [{ role: "system" as const, content: system.trim() }] : []),
      ...messages,
      { role: "user", content: text },
    ];

    // Append the user's turn and an empty assistant bubble the deltas fill.
    setMessages([...messages, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const usage = await streamCompletion(
        { model, messages: thread, temperature, maxTokens },
        {
          signal: controller.signal,
          onDelta: (delta) =>
            setMessages((list) => {
              const next = [...list];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + delta };
              }
              return next;
            }),
        },
      );
      setLastUsage({
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      });
    } catch (error) {
      // A deliberate Stop keeps whatever streamed in; a real failure does not.
      if ((error as Error).name !== "AbortError") {
        toast.error((error as Error).message || "The request failed.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      // Drop the placeholder if the reply never produced any text.
      setMessages((list) => {
        const last = list[list.length - 1];
        if (last?.role === "assistant" && last.content.trim() === "") {
          return list.slice(0, -1);
        }
        return list;
      });
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <>
      <PageHead
        title="Playground"
        sub="Try a model against your account. Each reply is billed like a real request."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: 16,
          marginTop: 20,
          alignItems: "start",
        }}
      >
        <div className="panel" style={{ padding: 16, display: "flex", flexDirection: "column", height: 600 }}>
          <StickToBottom
            resize="smooth"
            initial="smooth"
            style={{ flex: 1, minHeight: 0 }}
          >
            <StickToBottom.Content
              style={{ display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}
            >
              {messages.length === 0 ? (
                <p className="note" style={{ margin: "auto", textAlign: "center" }}>
                  Send a message to start. The conversation stays in this tab and is
                  not saved.
                </p>
              ) : (
                messages.map((m, i) => {
                  const streaming = busy && i === messages.length - 1 && m.role === "assistant";
                  return (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        background: m.role === "user" ? "var(--d-soft)" : "var(--surface)",
                        border: "1px solid var(--d-line)",
                        borderRadius: 12,
                        padding: "10px 13px",
                        whiteSpace: m.role === "assistant" ? "normal" : "pre-wrap",
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {m.role === "assistant" ? (
                        <Markdown content={m.content} streaming={streaming} />
                      ) : (
                        m.content
                      )}
                    </div>
                  );
                })
              )}
            </StickToBottom.Content>
          </StickToBottom>

          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "flex-end" }}>
            <textarea
              className="field"
              style={{ flex: 1, height: 78, padding: 10, resize: "vertical", lineHeight: 1.45 }}
              placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            {busy ? (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={stop}
                style={{ height: 38 }}
              >
                <Square size={15} />
                Stop
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={!input.trim()}
                onClick={send}
                style={{ height: 38 }}
              >
                <Send size={15} />
                Send
              </button>
            )}
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <b style={{ fontSize: 14 }}>Model</b>
          {models.length > 8 ? (
            <input
              className="field"
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Filter models…"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
            />
          ) : null}
          <Select
            label="Model"
            block
            value={model}
            onChange={setModel}
            style={{ marginTop: 8 }}
            options={(modelFilter.trim() ? visibleModels : models).map((m) => ({
              value: m,
              label: m,
              icon: <ModelIcon model={m} />,
            }))}
            emptyLabel="No models match the filter"
          />

          <b style={{ fontSize: 14, display: "block", marginTop: 16 }}>System prompt</b>
          <textarea
            className="field"
            style={{ width: "100%", height: 70, padding: 10, marginTop: 8, resize: "vertical" }}
            placeholder="Optional instructions for the model"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
          />

          <b style={{ fontSize: 14, display: "block", marginTop: 16 }}>
            Temperature <span className="note">{temperature.toFixed(1)}</span>
          </b>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            style={{ width: "100%", marginTop: 6 }}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />

          <b style={{ fontSize: 14, display: "block", marginTop: 12 }}>
            Max tokens <span className="note">{maxTokens}</span>
          </b>
          <input
            type="range"
            min={16}
            max={4096}
            step={16}
            value={maxTokens}
            style={{ width: "100%", marginTop: 6 }}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
          />

          {lastUsage ? (
            <div style={{ marginTop: 16 }}>
              <Pill tone="role">{lastUsage.model}</Pill>
              <p className="note" style={{ marginTop: 8 }}>
                Last reply: {lastUsage.promptTokens.toLocaleString()} tokens in,{" "}
                {lastUsage.completionTokens.toLocaleString()} out.
              </p>
            </div>
          ) : null}

          <button
            className="btn btn-ghost btn-sm"
            type="button"
            style={{ marginTop: 16, width: "100%" }}
            onClick={() => {
              abortRef.current?.abort();
              setMessages([]);
              setLastUsage(null);
            }}
          >
            <Trash2 size={15} /> Clear conversation
          </button>
        </div>
      </div>
    </>
  );
}
