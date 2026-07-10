"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { AdminMessage, UserType, AdminRole } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import ChatMessage from "./chat/ChatMessage";
import ChatInput from "./chat/ChatInput";
import EmojiPicker from "./chat/EmojiPicker";

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
  const [activePicker, setActivePicker] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPickerMounted(true);
    return () => setPickerMounted(false);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const handleOpenFullPicker = useCallback((messageId: string, buttonRect: DOMRect) => {
    let pickerLeft = buttonRect.left - 320 + buttonRect.width;
    if (pickerLeft < 10) pickerLeft = 10;
    
    let pickerTop = buttonRect.top - 360 - 5;
    if (buttonRect.top - 360 - 5 < 10) {
      pickerTop = buttonRect.top + buttonRect.height + 5;
    }
    
    setActivePicker({ messageId, x: pickerLeft, y: pickerTop });
  }, []);
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

  function formatReplyContent(message: Pick<AdminMessage, "content" | "media_url" | "media_type">) {
    if (!message.media_url) return message.content;
    const mediaLabel =
      message.media_type === "video"
        ? `🎥 ${t("chat.mediaVideo")}`
        : `📷 ${t("chat.mediaImage")}`;
    return message.content ? `${mediaLabel}: ${message.content}` : mediaLabel;
  }

  async function send(mediaUrl?: string | null, mediaType?: "image" | "video" | null) {
    const content = text.trim();
    if (!content && !mediaUrl) return;
    if (sending) return;
    setSending(true);
    setText("");
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);

    const { data, error: insertError } = await supabase
      .from("admin_messages")
      .insert({ 
        sender_id: currentUserId, 
        content, 
        reply_to_id: replyToId,
        media_url: mediaUrl || null,
        media_type: mediaType || null
      })
      .select()
      .single();

    if (insertError) {
      if (content) setText(content);
      showError(t("chat.sendFailed"));
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
    setReplyingTo({ id: msg.id, content: formatReplyContent(msg), senderName: senderInfo?.display_name || "Admin" });
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
      showError(t("chat.editFailed"));
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
      showError(t("chat.deleteFailed"));
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
        )
      );
    }
  };

  const handleJumpToMessage = useCallback((messageId: string) => {
    const target = scrollAreaRef.current?.querySelector<HTMLElement>(
      `[data-chat-message-id="${messageId}"]`
    );
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 1800);
  }, []);

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
      showError(t("chat.actionFailed"));
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
      showError(t("chat.actionFailed"));
    } else {
      refetchReactions();
    }
  };

  return (
    <div className="rounded-xl2 glass-card flex flex-col h-[calc(100vh-280px)] min-h-[480px]">
      {error && (
        <div className="mx-4 mt-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5">
          {error}
        </div>
      )}

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 space-y-3">
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
          const replyContent = replyMsg ? formatReplyContent(replyMsg) : "";
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
              replyTo={replyMsg ? { id: replyMsg.id, content: replyContent, senderName: replySender?.display_name || "Admin" } : null}
              reactions={msgReactions}
              profileBasePath="/admin/profile"
              showSender={!isMine}
              mediaUrl={m.media_url}
              mediaType={m.media_type}
              highlighted={highlightedMessageId === m.id}
              onReply={handleReply}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
              onReact={handleReact}
              onRemoveReact={handleRemoveReact}
              onOpenFullPicker={handleOpenFullPicker}
              onJumpToMessage={handleJumpToMessage}
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

      {pickerMounted && activePicker && createPortal(
        <div 
          className="fixed z-[9999]"
          style={{ top: activePicker.y, left: activePicker.x }}
        >
          <EmojiPicker
            positionClass="relative"
            onSelect={(emoji) => {
              handleReact(activePicker.messageId, emoji);
              setActivePicker(null);
            }}
            onClose={() => setActivePicker(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
