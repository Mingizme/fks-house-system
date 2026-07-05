"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DirectMessage } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import ChatMessage from "./chat/ChatMessage";
import ChatInput from "./chat/ChatInput";

interface Props {
  currentUserId: string;
  otherUser: { id: string; display_name: string; avatar_emoji: string | null; avatar_url: string | null };
  initialMessages: DirectMessage[];
  profileBasePath: string;
  isAdminChat?: boolean;
  initiallyBlocked?: boolean;
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
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; userIds: string[] }[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const refetchReactions = useCallback(() => {
    const msgIds = messages.map((m) => m.id);
    if (msgIds.length === 0) return;
    supabase
      .from("message_reactions")
      .select("*")
      .eq("message_type", "dm")
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
      .channel(`dm-${[currentUserId, otherUser.id].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${currentUserId}` },
        (payload) => {
          const row = payload.new as DirectMessage;
          if (row.sender_id === otherUser.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as DirectMessage;
          if (row.sender_id === otherUser.id || row.recipient_id === otherUser.id) {
            setMessages((prev) =>
              prev.map((m) => (m.id === row.id ? row : m))
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: "message_type=eq.dm" },
        () => {
          refetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUser.id, supabase, refetchReactions]);

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
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);

    const { data, error: insertError } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: currentUserId,
        recipient_id: otherUser.id,
        content,
        is_admin_chat: isAdminChat,
        reply_to_id: replyToId,
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

  const handleReply = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const senderName = msg.sender_id === currentUserId ? "You" : otherUser.display_name;
    setReplyingTo({ id: msg.id, content: msg.content, senderName });
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
      .from("direct_messages")
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
      .from("direct_messages")
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
        message_type: "dm",
        message_id: messageId,
      });

    if (err && err.code !== "23505") { // Ignore unique constraint violation
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
      .eq("message_type", "dm")
      .eq("message_id", messageId);

    if (err) {
      showError("Action failed.");
    } else {
      refetchReactions();
    }
  };

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

      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-ink-muted text-center mt-8">{t("messages.noDirectMessages")}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const msgReactions = reactions[m.id] || [];
          const replyMsg = m.reply_to_id ? messages.find((r) => r.id === m.reply_to_id) : null;
          return (
            <ChatMessage
              key={m.id}
              id={m.id}
              content={m.content}
              senderId={m.sender_id}
              senderName={mine ? undefined : otherUser.display_name}
              senderEmoji={mine ? null : otherUser.avatar_emoji}
              senderAvatarUrl={mine ? null : otherUser.avatar_url}
              currentUserId={currentUserId}
              timestamp={m.created_at}
              editedAt={m.edited_at}
              deletedAt={m.deleted_at}
              replyTo={replyMsg ? { id: replyMsg.id, content: replyMsg.content, senderName: replyMsg.sender_id === currentUserId ? "You" : otherUser.display_name } : null}
              reactions={msgReactions}
              profileBasePath={profileBasePath}
              showSender={false}
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
        disabled={blocked}
        placeholder={blocked ? t("messages.blockedPlaceholder") : t("messages.placeholder")}
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
