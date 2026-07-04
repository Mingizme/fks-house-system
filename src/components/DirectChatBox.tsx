"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { DirectMessage } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";

interface Props {
  currentUserId: string;
  otherUser: { id: string; display_name: string; avatar_emoji: string | null; avatar_url: string | null };
  initialMessages: DirectMessage[];
  profileBasePath: string;
  isAdminChat?: boolean;
  initiallyBlocked?: boolean;
}

export function DirectChatBox({
  currentUserId,
  otherUser,
  initialMessages,
  profileBasePath,
  isAdminChat = false,
  initiallyBlocked = false,
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`dm-${[currentUserId, otherUser.id].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${currentUserId}` },
        (payload) => {
          const row = payload.new as DirectMessage;
          if (row.sender_id === otherUser.id) {
            setMessages((prev) => [...prev, row]);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUser.id, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending || blocked) return;
    setSending(true);
    setText("");
    const { data, error: insertError } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: currentUserId,
        recipient_id: otherUser.id,
        content,
        is_admin_chat: isAdminChat,
      })
      .select()
      .single();
    if (insertError) {
      setText(content);
      showError("Could not send message. Please try again.");
    } else if (data) {
      setMessages((prev) => [...prev, data as DirectMessage]);
    }
    setSending(false);
  }

  async function toggleBlock() {
    const prevBlocked = blocked;
    try {
      if (blocked) {
        setBlocked(false);
        const { error: err } = await supabase.from("blocks").delete().eq("blocker_id", currentUserId).eq("blocked_id", otherUser.id);
        if (err) throw err;
      } else {
        setBlocked(true);
        const { error: err } = await supabase.from("blocks").insert({ blocker_id: currentUserId, blocked_id: otherUser.id });
        if (err) throw err;
      }
    } catch {
      setBlocked(prevBlocked);
      showError("Action failed. Please try again.");
    }
  }

  return (
    <div className="flex flex-col h-[560px] rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden">
      <div className="p-4 border-b border-ink-border flex items-center justify-between gap-3">
        <Link
          href={`${profileBasePath}/${otherUser.id}`}
          className="flex min-w-0 items-center gap-2 rounded-lg pr-2 hover:text-command transition-colors"
          aria-label={t("member.viewProfile")}
        >
          <span className="w-7 h-7 rounded-full bg-ink-surface2 border border-ink-border flex items-center justify-center text-lg overflow-hidden shrink-0">
            {otherUser.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              otherUser.avatar_emoji ?? "\u{1F642}"
            )}
          </span>
          <span className="font-semibold truncate">{otherUser.display_name}</span>
        </Link>
        <button
          onClick={toggleBlock}
          aria-label={blocked ? t("messages.unblock") : t("messages.block")}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${
            blocked
              ? "border-danger/40 text-danger bg-danger/10 hover:bg-danger/15"
              : "border-ink-border text-ink-muted hover:text-danger hover:border-danger/40"
          }`}
        >
          {blocked ? t("messages.unblock") : t("messages.block")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-ink-muted text-center mt-8">{t("messages.noDirectMessages")}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%] flex flex-col gap-1">
                <div
                  className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    mine ? "bg-command text-white rounded-br-sm ml-auto" : "bg-ink-surface2 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
                <span className={`text-[10px] text-ink-faint px-1 font-mono ${mine ? "text-right" : ""}`}>
                  {format(new Date(m.created_at), "HH:mm")}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-3 pb-1">
          <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5">{error}</p>
        </div>
      )}

      <div className="p-3 border-t border-ink-border flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={blocked}
          placeholder={blocked ? t("messages.blockedPlaceholder") : t("messages.placeholder")}
          aria-label={t("messages.placeholder")}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending || blocked}
          className="px-4 rounded-lg bg-command hover:bg-command/85 disabled:opacity-40 transition-colors font-semibold text-sm"
        >
          {t("common.send")}
        </button>
      </div>
    </div>
  );
}
