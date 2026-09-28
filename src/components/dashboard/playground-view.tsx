"use client";

import { useEffect, useRef, useState } from "react";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { Select } from "@/components/ui/select";
import { Send, Square, Trash2 } from "lucide-react";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * A minimal chat playground.
 *
 * Requests are proxied through this app so the relay key stays on the server.
 * Each call costs the account's balance, which the reply reports back so the
 * price of a prompt is visible rather than a surprise on the usage screen.
 */
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
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{
    model: string;
    promptTokens: number;
    completionTokens: number;
  } | null>(null);
  const [temperature, setTemperature] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [modelFilter, setModelFilter] = useState("");

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

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

    setMessages([...messages, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/playground", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages: thread, temperature, maxTokens }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            content?: string;
            model?: string;
            promptTokens?: number;
            completionTokens?: number;
            message?: string;
          }
        | null;

      if (!response.ok) {
        setError(payload?.message || "The request failed.");
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: payload?.content ?? "" }]);
      setLastUsage({
        model: payload?.model ?? model,
        promptTokens: payload?.promptTokens ?? 0,
        completionTokens: payload?.completionTokens ?? 0,
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

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
        <div className="panel" style={{ padding: 16, display: "flex", flexDirection: "column", minHeight: 460 }}>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              paddingRight: 4,
              maxHeight: 520,
            }}
          >
            {messages.length === 0 ? (
              <p className="note" style={{ margin: "auto", textAlign: "center" }}>
                Send a message to start. The conversation stays in this tab and is
                not saved.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    background: m.role === "user" ? "var(--d-soft)" : "#fff",
                    border: "1px solid var(--d-line)",
                    borderRadius: 12,
                    padding: "10px 13px",
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                </div>
              ))
            )}
            {busy ? <p className="note">Waiting for the model…</p> : null}
            <div ref={endRef} />
          </div>

          {error ? (
            <p className="note" style={{ color: "#b91c1c", marginTop: 10 }} role="alert">
              {error}
            </p>
          ) : null}

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
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={busy || !input.trim()}
              onClick={send}
              style={{ height: 38 }}
            >
              {busy ? <Square size={15} /> : <Send size={15} />}
              {busy ? "Running" : "Send"}
            </button>
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
              setMessages([]);
              setError(null);
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
