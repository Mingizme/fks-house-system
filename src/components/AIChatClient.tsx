"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Audience = "player" | "admin";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const playerPrompts = [
  "How do I send an image in chat?",
  "How do I reply to or edit a message?",
  "Who is the Housemaster of Arctic Wolves?",
  "Summarize the FKS house system.",
];

const adminPrompts = [
  "How do I mute or ban a player?",
  "How do I assign a player to a house?",
  "Who has full Office Key access in FKS data?",
  "Summarize all FKS departments.",
];

export function AIChatClient({ audience }: { audience: Audience }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        audience === "admin"
          ? "Ask about FKS data, app usage, or admin workflows."
          : "Ask about FKS data or app usage.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = audience === "admin" ? adminPrompts : playerPrompts;

  const apiMessages = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...apiMessages, { role: userMessage.role, content: userMessage.content }];
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);
    let assistantId: string | null = null;

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("Content-Type") ?? "";
        const errorBody = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : null;
        throw new Error(errorBody?.error || "AI request failed.");
      }

      if (!response.body) {
        throw new Error("AI response stream is empty.");
      }

      const streamingId = crypto.randomUUID();
      assistantId = streamingId;
      setMessages((current) => [
        ...current,
        {
          id: streamingId,
          role: "assistant",
          content: "",
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        answer += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === streamingId ? { ...message, content: answer } : message
          )
        );
      }

      answer += decoder.decode();
      if (!answer.trim()) {
        throw new Error("AI returned an empty response.");
      }
    } catch (err) {
      if (assistantId) {
        setMessages((current) => current.filter((message) => message.id !== assistantId));
      }
      setError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full flex-col overflow-hidden p-0 sm:p-4 lg:h-[100dvh] lg:p-8 2xl:p-10">
      <section className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden bg-ink-surface/80 shadow-crest sm:rounded-xl2 sm:border sm:border-ink-border">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.14em] text-ink-muted">FKS AI</p>
            <h1 className="font-display text-2xl font-bold text-ink-text sm:text-3xl">AI Chat</h1>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.12em]",
              audience === "admin"
                ? "border-command/40 bg-command/10 text-command"
                : "border-ink-border bg-ink-surface2 text-ink-muted"
            )}
          >
            {audience === "admin" ? "Admin scope" : "Player scope"}
          </span>
        </header>

        <div className="shrink-0 border-b border-ink-border px-4 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage(prompt)}
                disabled={loading}
                className="shrink-0 rounded-full border border-ink-border bg-ink-surface2 px-3 py-2 text-left text-sm text-ink-muted hover:border-command/50 hover:text-ink-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-5 sm:px-6"
          role="log"
          aria-live="polite"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex w-full min-w-0", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "min-w-0 max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] lg:text-base lg:leading-7",
                  message.role === "user"
                    ? "rounded-br-md bg-command text-white"
                    : "rounded-bl-md border border-ink-border bg-ink-surface2 text-ink-text"
                )}
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {message.content || "Thinking..."}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex w-full min-w-0 justify-start">
              <div className="rounded-2xl rounded-bl-md border border-ink-border bg-ink-surface2 px-4 py-3 text-sm text-ink-muted">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="shrink-0 border-t border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger sm:px-6">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-ink-border px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:p-4"
        >
          <div className="flex items-end gap-2 rounded-xl2 border border-ink-border bg-ink-surface2 p-2 focus-within:border-command/50">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Ask FKS AI..."
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-ink-text outline-none placeholder:text-ink-faint lg:text-base"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-command px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-24"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
