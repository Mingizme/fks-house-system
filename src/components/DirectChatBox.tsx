"use client";

import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DirectMessage } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import { useIsMobile } from "@/lib/useIsMobile";
import { MobileChatShell } from "@/components/MobileChatShell";
import { useMuteStatus, MuteBanner } from "@/components/MuteControls";
import ChatMessage from "./chat/ChatMessage";
import ChatTimeDivider from "./chat/ChatTimeDivider";
import ChatInput from "./chat/ChatInput";
import EmojiPicker from "./chat/EmojiPicker";
import { shouldShowMessageTimeDivider } from "./chat/timeDividers";
import {
  addReaction,
  groupReactions,
  pruneReactions,
  removeReaction,
  type GroupedReactions,
  type MessageReactionRow,
} from "@/lib/chat-reactions";
import { resolveChatMarkdownSettings, type ChatMarkdownSettings } from "@/lib/chat-markdown-settings";

const MAX_LIVE_MESSAGES = 150;

interface Props {
  currentUserId: string;
  otherUser: { id: string; display_name: string; avatar_emoji: string | null; avatar_url: string | null };
  initialMessages: DirectMessage[];
  profileBasePath: string;
  isAdminChat?: boolean;
  initiallyBlocked?: boolean;
  composerMarkdownSettings?: ChatMarkdownSettings;
}

export function DirectChatBox({
  currentUserId,
  otherUser,
  initialMessages,
  profileBasePath,
  isAdminChat = false,
  initiallyBlocked = false,
  composerMarkdownSettings,
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const { isMuted: chatRestricted, muteStatus } = useMuteStatus(currentUserId, null);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<GroupedReactions>({});
  const [activePicker, setActivePicker] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdSetRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const composerFormattingSettings = resolveChatMarkdownSettings(composerMarkdownSettings);

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

  const refetchReactions = useCallback((ids?: string[]) => {
    const msgIds = ids ?? [...messageIdSetRef.current];
    if (msgIds.length === 0) {
      setReactions({});
      return;
    }
    supabase
      .from("message_reactions")
      .select("message_id,user_id,emoji")
      .eq("message_type", "dm")
      .in("message_id", msgIds)
      .then(({ data }) => {
        if (data) {
          setReactions(groupReactions(data as MessageReactionRow[]));
        }
      });
  }, [supabase]);

  useEffect(() => {
    refetchReactions();
  }, [refetchReactions]);

  useEffect(() => {
    const ids = new Set(messages.map((message) => message.id));
    messageIdSetRef.current = ids;
    setReactions((prev) => pruneReactions(prev, ids));
  }, [messages]);

  useEffect(() => {
    const isThreadMessage = (row: Pick<DirectMessage, "sender_id" | "recipient_id" | "is_admin_chat">) =>
      row.is_admin_chat === isAdminChat &&
      ((row.sender_id === currentUserId && row.recipient_id === otherUser.id) ||
        (row.sender_id === otherUser.id && row.recipient_id === currentUserId));

    const appendMessage = (row: DirectMessage) => {
      if (!isThreadMessage(row)) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row].slice(-MAX_LIVE_MESSAGES);
      });
    };

    const updateMessage = (row: DirectMessage) => {
      if (!isThreadMessage(row)) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === row.id ? row : m))
      );
    };

    const channel = supabase
      .channel(`dm-${[currentUserId, otherUser.id].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${currentUserId}` },
        (payload) => {
          appendMessage(payload.new as DirectMessage);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${currentUserId}` },
        (payload) => {
          appendMessage(payload.new as DirectMessage);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${currentUserId}` },
        (payload) => {
          updateMessage(payload.new as DirectMessage);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `sender_id=eq.${currentUserId}` },
        (payload) => {
          updateMessage(payload.new as DirectMessage);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions", filter: "message_type=eq.dm" },
        (payload) => {
          const row = payload.new as MessageReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          setReactions((prev) => addReaction(prev, row));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions", filter: "message_type=eq.dm" },
        (payload) => {
          const row = payload.old as Partial<MessageReactionRow>;
          if (!row.message_id || !row.user_id || !row.emoji) {
            refetchReactions();
            return;
          }
          if (!messageIdSetRef.current.has(row.message_id)) return;
          setReactions((prev) => removeReaction(prev, row as MessageReactionRow));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isAdminChat, otherUser.id, supabase, refetchReactions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  function formatReplyContent(message: Pick<DirectMessage, "content" | "media_url" | "media_type">) {
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
    if (sending || blocked) return;
    if (chatRestricted) {
      showError(t("chat.mutedCannotSend"));
      return;
    }
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
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        formatting_settings: composerFormattingSettings,
      })
      .select()
      .single();

    if (insertError) {
      if (content) setText(content);
      showError(t("chat.sendFailed"));
    } else if (data) {
      setMessages((prev) => [...prev, data as DirectMessage].slice(-MAX_LIVE_MESSAGES));
    }
    setSending(false);
  }

  const handleReply = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const senderName = msg.sender_id === currentUserId ? t("common.you") : otherUser.display_name;
    setReplyingTo({ id: msg.id, content: formatReplyContent(msg), senderName });
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
        formatting_settings: composerFormattingSettings,
      })
      .eq("id", msgId);

    if (err) {
      showError(t("chat.editFailed"));
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, content, edited_at: new Date().toISOString(), formatting_settings: composerFormattingSettings } : m
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
        message_type: "dm",
        message_id: messageId,
      });

    if (err && err.code !== "23505") { // Ignore unique constraint violation
      showError(t("chat.actionFailed"));
    } else {
      setReactions((prev) => addReaction(prev, { message_id: messageId, user_id: currentUserId, emoji }));
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
      showError(t("chat.actionFailed"));
    } else {
      setReactions((prev) => removeReaction(prev, { message_id: messageId, user_id: currentUserId, emoji }));
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
      showError(t("chat.actionFailed"));
    }
  }

  const backHref = profileBasePath.startsWith("/admin") ? "/admin/messages" : "/messages";

  const blockButton = (
    <button
      onClick={toggleBlock}
      aria-label={blocked ? t("messages.unblock") : t("messages.block")}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors shrink-0 lg:px-4 lg:py-2 lg:text-sm ${
        blocked
          ? "border-danger/40 text-danger bg-danger/10 hover:bg-danger/15"
          : "border-ink-border text-ink-muted hover:text-danger hover:border-danger/40"
      }`}
    >
      {blocked ? t("messages.unblock") : t("messages.block")}
    </button>
  );

  const messageList = (
    <>
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-6 sm:p-4 sm:pb-10 space-y-3 lg:p-6 lg:pb-12 lg:space-y-4" role="log" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-ink-muted text-center mt-8 lg:text-base">{t("messages.noDirectMessages")}</p>}
        {messages.map((m, index) => {
          const mine = m.sender_id === currentUserId;
          const msgReactions = reactions[m.id] || [];
          const replyMsg = m.reply_to_id ? messages.find((r) => r.id === m.reply_to_id) : null;
          const replyContent = replyMsg ? formatReplyContent(replyMsg) : "";
          const showTimeDivider = shouldShowMessageTimeDivider(m.created_at, messages[index - 1]?.created_at);
          return (
            <Fragment key={m.id}>
              {showTimeDivider && <ChatTimeDivider timestamp={m.created_at} />}
              <ChatMessage
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
                replyTo={replyMsg ? { id: replyMsg.id, content: replyContent, senderName: replyMsg.sender_id === currentUserId ? t("common.you") : otherUser.display_name } : null}
                reactions={msgReactions}
                profileBasePath={profileBasePath}
                showSender={false}
                showTimestamp={false}
                mediaUrl={m.media_url}
                mediaType={m.media_type}
                highlighted={highlightedMessageId === m.id}
                markdownSettings={m.formatting_settings}
                onReply={handleReply}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                onReact={handleReact}
                onRemoveReact={handleRemoveReact}
                onOpenFullPicker={handleOpenFullPicker}
                onJumpToMessage={handleJumpToMessage}
              />
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-3 pb-1">
          <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5 lg:text-sm">{error}</p>
        </div>
      )}

      <MuteBanner muteStatus={muteStatus} />

      <ChatInput
        value={text}
        onChange={setText}
        onSend={send}
        disabled={blocked || chatRestricted}
        placeholder={
          blocked
            ? t("messages.blockedPlaceholder")
            : chatRestricted
            ? t("chat.mutedCannotSend")
            : t("messages.placeholder")
        }
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
    </>
  );

  if (isMobile) {
    return (
      <MobileChatShell
        title={otherUser.display_name}
        backHref={backHref}
        drawer={
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-ink-surface2 border border-ink-border flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {otherUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  otherUser.avatar_emoji ?? "\u{1F642}"
                )}
              </span>
              <p className="font-semibold truncate">{otherUser.display_name}</p>
            </div>
            <Link
              href={`${profileBasePath}/${otherUser.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm bg-ink-surface2 hover:bg-ink-border transition-colors"
            >
              <span className="w-4 text-center">{"\u{1F464}"}</span>
              {t("member.viewProfile")}
            </Link>
            <div>{blockButton}</div>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-surface">{messageList}</div>
      </MobileChatShell>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-surface">
      <div className="flex items-center justify-between gap-3 border-b border-ink-border bg-ink-surface px-3 py-3 sm:p-4 lg:gap-4 lg:px-6 lg:py-4">
        <div className="flex items-center gap-3 min-w-0 lg:gap-4">
          <Link
            href={backHref}
            className="text-ink-muted hover:text-ink-text text-lg pr-1 lg:pr-2 lg:text-2xl"
            title={t("common.back")}
          >
            ←
          </Link>
          <Link
            href={`${profileBasePath}/${otherUser.id}`}
            className="flex min-w-0 items-center gap-2 rounded-lg pr-2 hover:text-command transition-colors lg:gap-3"
            aria-label={t("member.viewProfile")}
          >
            <span className="w-7 h-7 rounded-full bg-ink-surface2 border border-ink-border flex items-center justify-center text-lg overflow-hidden shrink-0 lg:h-11 lg:w-11 lg:text-2xl">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                otherUser.avatar_emoji ?? "\u{1F642}"
              )}
            </span>
            <span className="font-semibold truncate lg:text-xl">{otherUser.display_name}</span>
          </Link>
        </div>
        {blockButton}
      </div>

      {messageList}
    </div>
  );
}
