"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminMessage, UserType, AdminRole } from "@/lib/types";
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
  currentUserId: string;
  initialMessages: AdminMessage[];
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

export function AdminGroupChat({ currentUserId, initialMessages }: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<AdminMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; userIds: string[] }[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Map<string, SenderInfo>>(new Map());

  // Seed cache from initial messages
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
      .eq("message_type", "admin")
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
      .channel("admin-group-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_messages" },
        async (payload) => {
          const row = payload.new as AdminMessage;
          if (messages.some((m) => m.id === row.id)) return;

          let sender = profileCache.current.get(row.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name, avatar_emoji, avatar_url, user_type, admin_role")
              .eq("id", row.sender_id)
              .single();
            const newSender: SenderInfo = data ?? { display_name: "Admin", avatar_emoji: null, avatar_url: null, user_type: "admin" as UserType, admin_role: null };
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
        { event: "UPDATE", schema: "public", table: "admin_messages" },
        async (payload) => {
          const row = payload.new as AdminMessage;
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
        { event: "*", schema: "public", table: "message_reactions", filter: "message_type=eq.admin" },
        () => {
          refetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetchReactions, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);

    const { data, error: insertError } = await supabase
      .from("admin_messages")
      .insert({ sender_id: currentUserId, content, reply_to_id: replyToId })
      .select()
      .single();

    if (insertError) {
      setText(content);
      showError("Could not send message. Please try again.");
    } else if (data) {
      const sender = profileCache.current.get(currentUserId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, { ...(data as AdminMessage), sender }];
      });
    }
    setSending(false);
  }

  const handleReply = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const senderInfo = msg.sender as SenderInfo | undefined;
    setReplyingTo({ id: msg.id, content: msg.content, senderName: senderInfo?.display_name || "Admin" });
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
      .from("admin_messages")
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
      .from("admin_messages")
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
        message_type: "admin",
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
      .eq("message_type", "admin")
      .eq("message_id", messageId);

    if (err) {
      showError("Action failed.");
    } else {
      refetchReactions();
    }
  };

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface flex flex-col h-[500px]">
      {error && (
        <div className="mx-4 mt-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">
            {t("messages.noHouseMessages")}
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
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
              senderRole={senderInfo?.admin_role}
              currentUserId={currentUserId}
              timestamp={m.created_at}
              editedAt={m.edited_at}
              deletedAt={m.deleted_at}
              replyTo={replyMsg ? { id: replyMsg.id, content: replyMsg.content, senderName: replySender?.display_name || "Admin" } : null}
              reactions={msgReactions}
              profileBasePath="/admin/profile"
              showSender={!isMine}
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

      <ChatInput
        value={text}
        onChange={setText}
        onSend={send}
        placeholder={t("messages.placeholder")}
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
