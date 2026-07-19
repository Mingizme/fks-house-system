"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { HouseMessage, UserType, AdminRole, HouseRole } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import ChatMessage from "./chat/ChatMessage";
import ChatTimeDivider from "./chat/ChatTimeDivider";
import ChatInput from "./chat/ChatInput";
import EmojiPicker from "./chat/EmojiPicker";
import MeasuredChatRow from "./chat/MeasuredChatRow";
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
import { sanitizeChatContent } from "@/lib/chat-sanitize";

const MAX_LIVE_MESSAGES = 150;
const VIRTUAL_OVERSCAN_PX = 700;
const ESTIMATED_MESSAGE_HEIGHT = 124;
const ESTIMATED_DIVIDER_HEIGHT = 48;
const EMPTY_REACTIONS: GroupedReactions[string] = [];

type HouseVirtualRow =
  | { type: "divider"; key: string; timestamp: string }
  | { type: "message"; key: string; message: HouseMessage };

interface SenderInfo {
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  user_type: UserType;
  admin_role: AdminRole | null;
  house_role: HouseRole | null;
}

interface Props {
  houseId: string;
  currentUserId: string;
  initialMessages: HouseMessage[];
  profileBasePath: string;
  canModerate?: boolean;
  /** Optional mute banner inserted above the input when the viewer is muted */
  muteBanner?: React.ReactNode;
  /** viewer bị mute → input disabled */
  viewerMuted?: boolean;
  maxWords?: number;
  composerMarkdownSettings?: ChatMarkdownSettings;
}

export function HouseChatBox({
  houseId,
  currentUserId,
  initialMessages,
  profileBasePath,
  canModerate,
  muteBanner,
  viewerMuted,
  maxWords,
  composerMarkdownSettings,
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<HouseMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<GroupedReactions>({});
  const [activePicker, setActivePicker] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [scrollFrame, setScrollFrame] = useState({ top: 0, height: 0 });
  const [measureVersion, setMeasureVersion] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdSetRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const scrollRafRef = useRef<number | null>(null);
  const rowHeightsRef = useRef<Map<string, number>>(new Map());
  const isNearBottomRef = useRef(true);
  const pendingAutoScrollRef = useRef<ScrollBehavior | null>("auto");
  const composerFormattingSettings = useMemo(
    () => resolveChatMarkdownSettings(composerMarkdownSettings),
    [composerMarkdownSettings]
  );

  const messageById = useMemo(() => {
    const map = new Map<string, HouseMessage>();
    for (const message of messages) {
      map.set(message.id, message);
    }
    return map;
  }, [messages]);

  const rows = useMemo<HouseVirtualRow[]>(() => {
    const nextRows: HouseVirtualRow[] = [];
    messages.forEach((message, index) => {
      if (shouldShowMessageTimeDivider(message.created_at, messages[index - 1]?.created_at)) {
        nextRows.push({
          type: "divider",
          key: `divider-${message.created_at}-${message.id}`,
          timestamp: message.created_at,
        });
      }
      nextRows.push({ type: "message", key: `message-${message.id}`, message });
    });
    return nextRows;
  }, [messages]);

  const virtualLayout = useMemo(() => {
    let offset = 0;
    const measuredRows = rows.map((row) => {
      const height =
        rowHeightsRef.current.get(row.key) ??
        (row.type === "divider" ? ESTIMATED_DIVIDER_HEIGHT : ESTIMATED_MESSAGE_HEIGHT);
      const result = { row, start: offset, height };
      offset += height;
      return result;
    });

    const startY = Math.max(0, scrollFrame.top - VIRTUAL_OVERSCAN_PX);
    const endY = scrollFrame.top + scrollFrame.height + VIRTUAL_OVERSCAN_PX;
    let startIndex = measuredRows.findIndex((item) => item.start + item.height >= startY);
    if (startIndex === -1) startIndex = Math.max(0, measuredRows.length - 1);

    let endIndex = measuredRows.findIndex((item) => item.start > endY);
    if (endIndex === -1) endIndex = measuredRows.length;
    endIndex = Math.min(measuredRows.length, Math.max(endIndex + 1, startIndex + 1));

    const visible = measuredRows.slice(startIndex, endIndex);
    const topPadding = visible[0]?.start ?? 0;
    const last = visible[visible.length - 1];
    const bottomPadding = last ? Math.max(0, offset - (last.start + last.height)) : 0;

    return { visible, topPadding, bottomPadding, totalHeight: offset };
  }, [measureVersion, rows, scrollFrame]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const element = scrollAreaRef.current;
      if (!element) return;
      element.scrollTo({ top: element.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setScrollFrame({ top: element.scrollTop, height: element.clientHeight });
    });
  }, []);

  const handleMeasureRow = useCallback((rowKey: string, height: number) => {
    const roundedHeight = Math.ceil(height);
    if (rowHeightsRef.current.get(rowKey) === roundedHeight) return;
    rowHeightsRef.current.set(rowKey, roundedHeight);
    setMeasureVersion((version) => version + 1);
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollAreaRef.current;
    if (!element) return;

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const nextElement = scrollAreaRef.current;
      if (!nextElement) return;

      const distanceFromBottom =
        nextElement.scrollHeight - nextElement.scrollTop - nextElement.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 260;
      setScrollFrame({ top: nextElement.scrollTop, height: nextElement.clientHeight });
    });
  }, []);

  useLayoutEffect(() => {
    const element = scrollAreaRef.current;
    if (!element) return;
    setScrollFrame({ top: element.scrollTop, height: element.clientHeight });
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    if (!pendingAutoScrollRef.current) return;
    const behavior = pendingAutoScrollRef.current;
    pendingAutoScrollRef.current = null;
    scrollToBottom(behavior);
  }, [rows.length, scrollToBottom, virtualLayout.totalHeight]);

  useEffect(() => {
    const element = scrollAreaRef.current;
    if (!element) return;

    const update = () => setScrollFrame({ top: element.scrollTop, height: element.clientHeight });
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPickerMounted(true);
    return () => setPickerMounted(false);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
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

  useEffect(() => {
    initialMessages.forEach((m) => {
      if (m.sender) profileCache.current.set(m.sender_id, m.sender as SenderInfo);
    });
  }, [initialMessages]);

  const refetchReactions = useCallback((ids?: string[]) => {
    const msgIds = ids ?? [...messageIdSetRef.current];
    if (msgIds.length === 0) {
      setReactions({});
      return;
    }
    supabase
      .from("message_reactions")
      .select("message_id,user_id,emoji")
      .eq("message_type", "house")
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
              .select("display_name, avatar_emoji, avatar_url, user_type, admin_role, house_role")
              .eq("id", row.sender_id)
              .single();
            const newSender: SenderInfo = data ?? { display_name: "Unknown", avatar_emoji: null, avatar_url: null, user_type: "player", admin_role: null, house_role: null };
            profileCache.current.set(row.sender_id, newSender);
            sender = newSender;
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            if (isNearBottomRef.current) {
              pendingAutoScrollRef.current = "smooth";
            }
            return [...prev, { ...row, sender }].slice(-MAX_LIVE_MESSAGES);
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
                return {
                  ...m,
                  content: row.content,
                  edited_at: row.edited_at,
                  deleted_at: row.deleted_at,
                  formatting_settings: row.formatting_settings,
                };
              }
              return m;
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions", filter: "message_type=eq.house" },
        (payload) => {
          const row = payload.new as MessageReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          setReactions((prev) => addReaction(prev, row));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions", filter: "message_type=eq.house" },
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
  }, [houseId, supabase, refetchReactions]);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }, []);

  const formatReplyContent = useCallback(
    (message: Pick<HouseMessage, "content" | "media_url" | "media_type">) => {
      if (!message.media_url) return message.content;
      const mediaLabel =
        message.media_type === "video"
          ? `🎥 ${t("chat.mediaVideo")}`
          : `📷 ${t("chat.mediaImage")}`;
      return message.content ? `${mediaLabel}: ${message.content}` : mediaLabel;
    },
    [t]
  );

  const send = useCallback(
    async (
      rawContent: string,
      mediaUrl?: string | null,
      mediaType?: "image" | "video" | null,
      mediaThumbnailUrl?: string | null
    ) => {
      const content = sanitizeChatContent(rawContent);
      if (!content && !mediaUrl) return;
      if (sending) return;
      if (viewerMuted) {
        showError(t("chat.mutedCannotSend"));
        return;
      }
      setSending(true);
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
          media_thumbnail_url: mediaThumbnailUrl || null,
          media_type: mediaType || null,
          formatting_settings: composerFormattingSettings,
        });

      if (insertError) {
        showError(t("chat.sendFailed"));
      }
      setSending(false);
    },
    [
      composerFormattingSettings,
      currentUserId,
      houseId,
      replyingTo?.id,
      sending,
      showError,
      supabase,
      t,
      viewerMuted,
    ]
  );

  const handleReply = useCallback(
    (messageId: string) => {
      const msg = messageById.get(messageId);
      if (!msg) return;
      const senderInfo = msg.sender as SenderInfo | undefined;
      setReplyingTo({
        id: msg.id,
        content: formatReplyContent(msg),
        senderName: senderInfo?.display_name || "Unknown",
      });
    },
    [formatReplyContent, messageById]
  );

  const handleStartEdit = useCallback((messageId: string, content: string) => {
    setEditingMessage({ id: messageId, content });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (rawContent: string) => {
      const content = sanitizeChatContent(rawContent);
      if (!editingMessage || !content) return;
      const msgId = editingMessage.id;
      const editedAt = new Date().toISOString();
      setEditingMessage(null);

      const { error: err } = await supabase
        .from("house_messages")
        .update({
          content,
          edited_at: editedAt,
          formatting_settings: composerFormattingSettings,
        })
        .eq("id", msgId);

      if (err) {
        showError(t("chat.editFailed"));
      } else {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === msgId
              ? {
                  ...message,
                  content,
                  edited_at: editedAt,
                  formatting_settings: composerFormattingSettings,
                }
              : message
          )
        );
      }
    },
    [composerFormattingSettings, editingMessage, showError, supabase, t]
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!window.confirm(t("chat.confirmDelete"))) return;
      const deletedAt = new Date().toISOString();
      const { error: err } = await supabase
        .from("house_messages")
        .update({
          deleted_at: deletedAt,
        })
        .eq("id", messageId);

      if (err) {
        showError(t("chat.deleteFailed"));
      } else {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId ? { ...message, deleted_at: deletedAt } : message
          )
        );
      }
    },
    [showError, supabase, t]
  );

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      const element = scrollAreaRef.current;
      if (!element) return;

      let targetStart = 0;
      let targetHeight = ESTIMATED_MESSAGE_HEIGHT;
      let found = false;

      for (const row of rows) {
        const height =
          rowHeightsRef.current.get(row.key) ??
          (row.type === "divider" ? ESTIMATED_DIVIDER_HEIGHT : ESTIMATED_MESSAGE_HEIGHT);
        if (row.type === "message" && row.message.id === messageId) {
          targetHeight = height;
          found = true;
          break;
        }
        targetStart += height;
      }

      if (!found) return;

      pendingAutoScrollRef.current = null;
      element.scrollTo({
        top: Math.max(0, targetStart - element.clientHeight / 2 + targetHeight / 2),
        behavior: "smooth",
      });
      setHighlightedMessageId(messageId);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId((current) => (current === messageId ? null : current));
      }, 1800);
    },
    [rows]
  );

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      const { error: err } = await supabase
        .from("message_reactions")
        .insert({
          user_id: currentUserId,
          emoji,
          message_type: "house",
          message_id: messageId,
        });

      if (err && err.code !== "23505") {
        showError(t("chat.actionFailed"));
      } else {
        setReactions((prev) =>
          addReaction(prev, { message_id: messageId, user_id: currentUserId, emoji })
        );
      }
    },
    [currentUserId, showError, supabase, t]
  );

  const handleRemoveReact = useCallback(
    async (messageId: string, emoji: string) => {
      const { error: err } = await supabase
        .from("message_reactions")
        .delete()
        .eq("user_id", currentUserId)
        .eq("emoji", emoji)
        .eq("message_type", "house")
        .eq("message_id", messageId);

      if (err) {
        showError(t("chat.actionFailed"));
      } else {
        setReactions((prev) =>
          removeReaction(prev, { message_id: messageId, user_id: currentUserId, emoji })
        );
      }
    },
    [currentUserId, showError, supabase, t]
  );

  const renderMessageRow = useCallback(
    (message: HouseMessage) => {
      const mine = message.sender_id === currentUserId;
      const senderInfo = message.sender as SenderInfo | undefined;
      const messageReactions = reactions[message.id] ?? EMPTY_REACTIONS;
      const replyMessage = message.reply_to_id ? messageById.get(message.reply_to_id) : null;
      const replySender = replyMessage?.sender as SenderInfo | undefined;
      const replyContent = replyMessage ? formatReplyContent(replyMessage) : "";
      const roleLabel = senderInfo?.house_role
        ? t(senderInfo.house_role === "master" ? "role.houseMaster" : "role.viceMaster")
        : senderInfo?.user_type === "admin"
        ? senderInfo.admin_role
        : null;

      return (
        <ChatMessage
          id={message.id}
          content={message.content}
          senderId={message.sender_id}
          senderName={senderInfo?.display_name}
          senderEmoji={senderInfo?.avatar_emoji}
          senderAvatarUrl={senderInfo?.avatar_url}
          senderRole={roleLabel}
          currentUserId={currentUserId}
          timestamp={message.created_at}
          editedAt={message.edited_at}
          deletedAt={message.deleted_at}
          replyTo={
            replyMessage
              ? {
                  id: replyMessage.id,
                  content: replyContent,
                  senderName: replySender?.display_name || "Unknown",
                }
              : null
          }
          reactions={messageReactions}
          profileBasePath={profileBasePath}
          showSender={!mine}
          showTimestamp={false}
          canModerate={canModerate && !mine}
          mediaUrl={message.media_url}
          mediaThumbnailUrl={message.media_thumbnail_url}
          mediaType={message.media_type}
          highlighted={highlightedMessageId === message.id}
          markdownSettings={message.formatting_settings}
          onReply={handleReply}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
          onReact={handleReact}
          onRemoveReact={handleRemoveReact}
          onOpenFullPicker={handleOpenFullPicker}
          onJumpToMessage={handleJumpToMessage}
        />
      );
    },
    [
      canModerate,
      currentUserId,
      formatReplyContent,
      handleDelete,
      handleJumpToMessage,
      handleOpenFullPicker,
      handleReact,
      handleRemoveReact,
      handleReply,
      handleStartEdit,
      highlightedMessageId,
      messageById,
      profileBasePath,
      reactions,
      t,
    ]
  );

  return (
    <div className="chat-performance-surface flex h-full min-h-0 flex-col overflow-hidden rounded-xl2 glass-card">
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="chat-scroll-region flex-1 overflow-y-auto overflow-x-hidden p-3 pb-6 sm:p-4 sm:pb-10"
        role="log"
        aria-live="polite"
      >
        <div style={{ height: virtualLayout.topPadding }} />

        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">{t("messages.noHouseMessages")}</p>
        )}

        {virtualLayout.visible.map(({ row }) => (
          <MeasuredChatRow
            key={row.key}
            rowKey={row.key}
            onMeasure={handleMeasureRow}
            className="pb-3"
          >
            {row.type === "divider" ? (
              <ChatTimeDivider timestamp={row.timestamp} />
            ) : (
              renderMessageRow(row.message)
            )}
          </MeasuredChatRow>
        ))}

        <div style={{ height: virtualLayout.bottomPadding }} />
      </div>

      {error && (
        <div className="px-3 pb-1">
          <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5">{error}</p>
        </div>
      )}

      {muteBanner}

      <ChatInput
        onSend={send}
        placeholder={viewerMuted ? t("chat.mutedCannotSend") : t("messages.housePlaceholder")}
        sendLabel={t("common.send")}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        disabled={viewerMuted}
        maxWords={maxWords}
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
