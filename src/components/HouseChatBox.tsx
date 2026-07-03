"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HouseMessage, UserType, AdminRole } from "@/lib/types";
import { format } from "date-fns";
import { useI18n } from "@/components/I18nProvider";

interface SenderInfo {
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  user_type: UserType;
  admin_role: AdminRole | null;
}

interface Props {
  houseId: string;
  currentUserId: string;
  initialMessages: HouseMessage[];
}

export function HouseChatBox({ houseId, currentUserId, initialMessages }: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<HouseMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Map<string, SenderInfo>>(new Map());

  useEffect(() => {
    initialMessages.forEach((m) => {
      if (m.sender) profileCache.current.set(m.sender_id, m.sender as SenderInfo);
    });
  }, [initialMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`house-chat-${houseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "house_messages", filter: `house_id=eq.${houseId}` },
        async (payload) => {
          const row = payload.new as HouseMessage;
          let sender = profileCache.current.get(row.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name, avatar_emoji, avatar_url, user_type, admin_role")
              .eq("id", row.sender_id)
              .single();
            const newSender: SenderInfo = data ?? { display_name: "Unknown", avatar_emoji: null, avatar_url: null, user_type: "player", admin_role: null };
            profileCache.current.set(row.sender_id, newSender);
            sender = newSender;
          }
          setMessages((prev) => [...prev, { ...row, sender }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [houseId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const { error: insertError } = await supabase
      .from("house_messages")
      .insert({ house_id: houseId, sender_id: currentUserId, content });
    if (insertError) {
      setText(content);
      showError("Could not send message. Please try again.");
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[560px] rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">{t("messages.noHouseMessages")}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const isAdmin = m.sender?.user_type === "admin";
          const senderInfo = m.sender as SenderInfo | undefined;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {!mine && (
                  <span className="text-xs text-ink-muted px-1 flex items-center gap-1">
                    {senderInfo?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={senderInfo.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover inline-block" />
                    ) : (
                      senderInfo?.avatar_emoji
                    )}{" "}
                    {senderInfo?.display_name}
                    {isAdmin && <span className="text-command ml-1">· {senderInfo?.admin_role}</span>}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    mine ? "bg-command text-white rounded-br-sm" : "bg-ink-surface2 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[10px] text-ink-faint px-1 font-mono">{format(new Date(m.created_at), "HH:mm")}</span>
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
          placeholder={t("messages.housePlaceholder")}
          aria-label={t("messages.housePlaceholder")}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="px-4 rounded-lg bg-command hover:bg-command/85 disabled:opacity-40 transition-colors font-semibold text-sm"
        >
          {t("common.send")}
        </button>
      </div>
    </div>
  );
}
