"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquarePlus, Send, Square, Trash2 } from "lucide-react";
import { StickToBottom } from "use-stick-to-bottom";
import { toast } from "sonner";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { Markdown } from "@/components/markdown";
import { ModelIcon } from "@/components/model-icon";
import { Select } from "@/components/ui/select";
import { streamCompletion } from "@/lib/playground-stream";

type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

type Conversation = {
  id: string;
  title: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  updatedAt: number;
};

/** Starting points, mirroring the presets new-api offers next to Playground. */
const PRESETS: Array<{ id: string; label: string; system: string }> = [
  { id: "general", label: "General assistant", system: "You are a helpful, concise assistant." },
  {
    id: "code",
    label: "Code helper",
    system: "You are a senior software engineer. Reply with code and brief explanations.",
  },
  {
    id: "translate",
    label: "Translator",
    system: "Translate the user's text. If no target language is given, translate to English.",
  },
  {
    id: "summary",
    label: "Summarizer",
    system: "Summarize the user's text into clear bullet points.",
  },
  {
    id: "writer",
    label: "Writing coach",
    system: "Improve the user's writing: tighten it and fix grammar, keeping the meaning.",
  },
];

const STORAGE_KEY = "vipai.dashboard.chat";

function newConversation(model: string): Conversation {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: "New chat",
    model,
    system: PRESETS[0].system,
    messages: [],
    updatedAt: Date.now(),
  };
}

function loadConversations(model: string): Conversation[] {
  if (typeof window === "undefined") return [newConversation(model)];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [newConversation(model)];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [newConversation(model)];
    return parsed;
  } catch {
    return [newConversation(model)];
  }
}

function saveConversations(list: Conversation[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage is best-effort */
  }
}

/**
 * A saved-conversation chat.
 *
 * The Playground is a single throwaway thread; this keeps several, remembers
 * them between visits, and offers preset system prompts. Requests still go
 * through this app's proxy so the relay key stays server-side.
 *
 * Replies stream into the active thread. Saving is debounced: tokens arrive
 * many times a second and writing localStorage on every one would jank the
 * stream, so the write waits for a quiet moment.
 */
export function ChatView({
  models,
  defaultModel,
}: {
  models: string[];
  defaultModel: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelFilter, setModelFilter] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const saveTimer = useRef<number | null>(null);

  // Seed from storage after mount so the server and client renders match.
  useEffect(() => {
    const list = loadConversations(defaultModel);
    setConversations(list);
    setActiveId(list[0].id);
    return () => abortRef.current?.abort();
  }, [defaultModel]);

  useEffect(() => {
    if (conversations.length === 0) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveConversations(conversations);
      saveTimer.current = null;
    }, 400);
  }, [conversations]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0],
    [conversations, activeId],
  );

  const update = (id: string, patch: Partial<Conversation>) => {
    setConversations((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    );
  };

  const appendDelta = (id: string, delta: string) => {
    setConversations((list) =>
      list.map((c) => {
        if (c.id !== id) return c;
        const messages = [...c.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = { ...last, content: last.content + delta };
        }
        return { ...c, messages, updatedAt: Date.now() };
      }),
    );
  };

  const createConversation = () => {
    abortRef.current?.abort();
    const created = newConversation(active?.model ?? defaultModel);
    setConversations((list) => [created, ...list]);
    setActiveId(created.id);
  };

  const removeConversation = (id: string) => {
    if (id === activeId) abortRef.current?.abort();
    setConversations((list) => {
      const next = list.filter((c) => c.id !== id);
      if (next.length === 0) {
        const created = newConversation(defaultModel);
        setActiveId(created.id);
        return [created];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !active) return;

    const thread: ChatMessage[] = [
      ...(active.system.trim() ? [{ role: "system" as const, content: active.system.trim() }] : []),
      ...active.messages,
      { role: "user", content: text },
    ];
    const id = active.id;
    const title = active.messages.length === 0 ? text.slice(0, 40) : active.title;

    update(id, {
      messages: [...active.messages, { role: "user", content: text }, { role: "assistant", content: "" }],
      title,
    });
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamCompletion(
        {
          model: active.model,
          messages: thread,
          // A saved chat has no parameter panel; use the account defaults.
        },
        { signal: controller.signal, onDelta: (delta) => appendDelta(id, delta) },
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error((error as Error).message || "The request failed.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      // Drop a placeholder that never received any text.
      setConversations((list) =>
        list.map((c) => {
          if (c.id !== id) return c;
          const last = c.messages[c.messages.length - 1];
          if (last?.role === "assistant" && last.content.trim() === "") {
            return { ...c, messages: c.messages.slice(0, -1) };
          }
          return c;
        }),
      );
    }
  };

  const visibleModels = modelFilter.trim()
    ? models.filter((m) => m.toLowerCase().includes(modelFilter.trim().toLowerCase()))
    : models;

  return (
    <>
      <PageHead
        title="Chat"
        sub="A saved conversation workspace. Presets, history and streaming replies."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0,1fr)",
          gap: 16,
          marginTop: 20,
          alignItems: "start",
        }}
      >
        <div className="panel" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-primary btn-sm" type="button" onClick={createConversation}>
            <MessageSquarePlus size={15} /> New chat
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto" }}>
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={`dash-tab${conversation.id === active?.id ? " is-on" : ""}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                >
                  {conversation.title || "New chat"}
                </button>
                <button
                  type="button"
                  className="ov-iconbtn"
                  aria-label="Delete conversation"
                  onClick={() => removeConversation(conversation.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: 16, display: "flex", flexDirection: "column", height: 600 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            {models.length > 8 ? (
              <input
                className="field"
                style={{ minWidth: 150 }}
                placeholder="Filter models…"
                aria-label="Filter models"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
              />
            ) : null}
            <Select
              label="Model"
              value={active?.model ?? ""}
              onChange={(model) => active && update(active.id, { model })}
              options={(modelFilter.trim() ? visibleModels : models).map((m) => ({
                value: m,
                label: m,
                icon: <ModelIcon model={m} />,
              }))}
              emptyLabel="No models match the filter"
            />
            <Select
              label="Preset"
              value={active?.system ?? PRESETS[0].system}
              onChange={(system) => active && update(active.id, { system })}
              options={PRESETS.map((preset) => ({ value: preset.system, label: preset.label }))}
            />
            {active ? <Pill tone="role">{active.messages.length} messages</Pill> : null}
          </div>

          <StickToBottom resize="smooth" initial="smooth" style={{ flex: 1, minHeight: 0 }}>
            <StickToBottom.Content
              style={{ display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}
            >
              {!active || active.messages.length === 0 ? (
                <p className="note" style={{ margin: "auto", textAlign: "center" }}>
                  Start a new conversation. Chats are saved in this browser.
                </p>
              ) : (
                active.messages.map((message, index) => {
                  const streaming =
                    busy && index === active.messages.length - 1 && message.role === "assistant";
                  return (
                    <div
                      key={index}
                      style={{
                        alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        background: message.role === "user" ? "var(--d-soft)" : "var(--surface)",
                        border: "1px solid var(--d-line)",
                        borderRadius: 12,
                        padding: "10px 13px",
                        whiteSpace: message.role === "assistant" ? "normal" : "pre-wrap",
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}
                    >
                      {message.role === "assistant" ? (
                        <Markdown content={message.content} streaming={streaming} />
                      ) : (
                        message.content
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
                onClick={() => abortRef.current?.abort()}
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
      </div>
    </>
  );
}
