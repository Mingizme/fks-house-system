"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { HouseMessage, UserType, AdminRole } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import ChatMessage from "./chat/ChatMessage";
import ChatInput from "./chat/ChatInput";

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
  profileBasePath: string;
}

function groupReactions(reactionsList: any[]) {
  const grouped: Record<string, { emoji: string; count: number; userIds: string[] }[]> = {};
  for (const r of reactionsList) {
    if (!grouped[r.message_id]) grouped[r.message_id] = [];
    const existing = grouped[r.message_id].find((x) => x.emoji === r.emoji);
    if (existing) {
      if (!existing.userIds.includes(r.user_id)) {
        existing.userIds.push(r.user_id);
        existing.count++;
      }
    } else {
      grouped[r.message_id].push({
        emoji: r.emoji,
        count: 1,
        userIds: [r.user_id],
      });
    }
  }
  return grouped;
}

export function HouseChatBox({ houseId, currentUserId, initialMessages, profileBasePath }: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<HouseMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; userIds: string[] }[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Map<string, SenderInfo>>(new Map());

  useEffect(() => {
    initialMessages.forEach((m) => {
      if (m.sender) profileCache.current.set(m.sender_id, m.sender as SenderInfo);
    });
  }, [initialMessages]);

  const refetchReactions = useCallback(() => {
    const msgIds = messages.map((m) => m.id);
    if (msgIds.length === 0) return;
    supabase
      .from("message_reactions")
      .select("*")
      .eq("message_type", "house")
      .in("message_id", msgIds)
      .then(({ data }) => {
        if (data) {
          setReactions(groupReactions(data));
        }
      });
  }, [messages, supabase]);

  useEffect(() => {
    refetchReactions();
  }, [messages.length, refetchReactions]);

  useEffect(() => {
    const channel = supabase
      .channel(`house-chat-${houseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "house_messages", filter: `house_id=eq.${houseId}` },
        async (payload) => {
          const row = payload.new as HouseMessage;
          if (messages.some((m) => m.id === row.id)) return;

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
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, sender }];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "house_messages", filter: `house_id=eq.${houseId}` },
        async (payload) => {
          const row = payload.new as HouseMessage;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === row.id) {
                return { ...m, content: row.content, edited_at: row.edited_at, deleted_at: row.deleted_at };
              }
              return m;
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: "message_type=eq.house" },
        () => {
          refetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [houseId, supabase, refetchReactions, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  async function send(mediaUrl?: string | null, mediaType?: "image" | "video" | null) {
    const content = text.trim();
    if (!content && !mediaUrl) return;
    if (sending) return;
    setSending(true);
    setText("");
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);

    const { error: insertError } = await supabase
      .from("house_messages")
      .insert({ 
        house_id: houseId, 
        sender_id: currentUserId, 
        content, 
        reply_to_id: replyToId,
        media_url: mediaUrl || null,
        media_type: mediaType || null
      });

    if (insertError) {
      if (content) setText(content);
      showError("Could not send message. Please try again.");
    }
    setSending(false);
  }

  const handleReply = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const senderInfo = msg.sender as SenderInfo | undefined;
    setReplyingTo({ id: msg.id, content: msg.content, senderName: senderInfo?.display_name || "Unknown" });
  };

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessage({ id: messageId, content });
    setText(content);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setText("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !text.trim()) return;
    const content = text.trim();
    const msgId = editingMessage.id;
    setEditingMessage(null);
    setText("");

    const { error: err } = await supabase
      .from("house_messages")
      .update({
        content,
        edited_at: new Date().toISOString(),
      })
      .eq("id", msgId);

    if (err) {
      showError("Could not edit message. Please try again.");
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, content, edited_at: new Date().toISOString() } : m
        )
      );
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!window.confirm(t("chat.confirmDelete"))) return;
    const { error: err } = await supabase
      .from("house_messages")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    if (err) {
      showError("Could not delete message. Please try again.");
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
        )
      );
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    const { error: err } = await supabase
      .from("message_reactions")
      .insert({
        user_id: currentUserId,
        emoji,
        message_type: "house",
        message_id: messageId,
      });

    if (err && err.code !== "23505") {
      showError("Action failed.");
    } else {
      refetchReactions();
    }
  };

  const handleRemoveReact = async (messageId: string, emoji: string) => {
    const { error: err } = await supabase
      .from("message_reactions")
      .delete()
      .eq("user_id", currentUserId)
      .eq("emoji", emoji)
      .eq("message_type", "house")
      .eq("message_id", messageId);

    if (err) {
      showError("Action failed.");
    } else {
      refetchReactions();
    }
  };

  return (
    <div className="flex flex-col h-[560px] rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">{t("messages.noHouseMessages")}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const senderInfo = m.sender as SenderInfo | undefined;
          const msgReactions = reactions[m.id] || [];
          const replyMsg = m.reply_to_id ? messages.find((r) => r.id === m.reply_to_id) : null;
          const replySender = replyMsg?.sender as SenderInfo | undefined;

          return (
            <ChatMessage
              key={m.id}
              id={m.id}
              content={m.content}
              senderId={m.sender_id}
              senderName={senderInfo?.display_name}
              senderEmoji={senderInfo?.avatar_emoji}
              senderAvatarUrl={senderInfo?.avatar_url}
              senderRole={senderInfo?.user_type === "admin" ? senderInfo.admin_role : null}
              currentUserId={currentUserId}
              timestamp={m.created_at}
              editedAt={m.edited_at}
              deletedAt={m.deleted_at}
              replyTo={replyMsg ? { id: replyMsg.id, content: replyMsg.content, senderName: replySender?.display_name || "Unknown" } : null}
              reactions={msgReactions}
              profileBasePath={profileBasePath}
              showSender={!mine}
              mediaUrl={m.media_url}
              mediaType={m.media_type}
              onReply={handleReply}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
              onReact={handleReact}
              onRemoveReact={handleRemoveReact}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-3 pb-1">
          <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5">{error}</p>
        </div>
      )}

      <ChatInput
        value={text}
        onChange={setText}
        onSend={send}
        placeholder={t("messages.housePlaceholder")}
        sendLabel={t("common.send")}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
      />
    </div>
  );
}
