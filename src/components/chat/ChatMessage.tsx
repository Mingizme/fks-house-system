"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { format } from "date-fns";
import { useI18n } from "@/components/I18nProvider";
import ChatMarkdown, { type ChatMarkdownSettings } from "@/components/chat/ChatMarkdown";
import MediaLightbox from "@/components/chat/MediaLightbox";
import EmojiPicker from "@/components/chat/EmojiPicker";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

let cancelActiveHover: (() => void) | null = null;

interface ChatMessageProps {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  senderEmoji?: string | null;
  senderAvatarUrl?: string | null;
  senderRole?: string | null;
  currentUserId: string;
  timestamp: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyTo?: { id: string; content: string; senderName: string } | null;
  reactions: { emoji: string; count: number; userIds: string[] }[];
  profileBasePath?: string;
  showSender?: boolean;
  canModerate?: boolean;
  mediaUrl?: string | null;
  mediaThumbnailUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  highlighted?: boolean;
  showTimestamp?: boolean;
  markdownSettings?: ChatMarkdownSettings | null;
  deliveryStatus?: "sending" | "offline" | "sent" | "read" | "failed";
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
  onOpenFullPicker: (messageId: string, buttonRect: DOMRect) => void;
  onJumpToMessage?: (messageId: string) => void;
  onRetrySend?: (messageId: string) => void;
}

export default function ChatMessage({
  id,
  content,
  senderId,
  senderName,
  senderEmoji,
  senderAvatarUrl,
  senderRole,
  currentUserId,
  timestamp,
  editedAt,
  deletedAt,
  replyTo,
  reactions,
  profileBasePath,
  showSender,
  canModerate,
  mediaUrl,
  mediaThumbnailUrl,
  mediaType,
  highlighted,
  showTimestamp = true,
  markdownSettings,
  deliveryStatus,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRemoveReact,
  onOpenFullPicker,
  onJumpToMessage,
  onRetrySend,
}: ChatMessageProps) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [showQuickReact, setShowQuickReact] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [showSheetEmojiPicker, setShowSheetEmojiPicker] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const quickReactRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeHover = useCallback(() => {
    setHovered(false);
    setShowQuickReact(false);
    if (cancelActiveHover === closeHover) {
      cancelActiveHover = null;
    }
  }, []);

  const handleMouseEnter = () => {
    if (cancelActiveHover && cancelActiveHover !== closeHover) {
      cancelActiveHover();
    }

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    setHovered(true);
    cancelActiveHover = closeHover;
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      closeHover();
    }, 150);
  };

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const closeActionSheet = useCallback(() => {
    setActionSheetOpen(false);
    setShowSheetEmojiPicker(false);
  }, []);

  const openActionSheet = useCallback(() => {
    setShowQuickReact(false);
    closeHover();
    setShowSheetEmojiPicker(false);
    setActionSheetOpen(true);
  }, [closeHover]);

  const clearTextSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleTouchStart = () => {
    clearTextSelection();
    clearLongPressTimer();
    longPressTimeoutRef.current = setTimeout(() => {
      clearTextSelection();
      openActionSheet();
    }, 520);
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
      event.preventDefault();
      clearLongPressTimer();
      clearTextSelection();
      openActionSheet();
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      clearLongPressTimer();
      if (cancelActiveHover === closeHover) {
        cancelActiveHover = null;
      }
    };
  }, [clearLongPressTimer, closeHover]);

  useEffect(() => {
    if (!actionSheetOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [actionSheetOpen]);

  const isMine = senderId === currentUserId;
  const isDeleted = !!deletedAt;
  const previewMediaUrl = mediaThumbnailUrl || mediaUrl;
  const statusLabel =
    deliveryStatus === "sending"
      ? t("chat.sending")
      : deliveryStatus === "offline"
      ? t("chat.offlineQueued")
      : deliveryStatus === "failed"
      ? t("chat.failed")
      : deliveryStatus === "read"
      ? t("chat.read")
      : deliveryStatus === "sent"
      ? t("chat.sent")
      : null;

  // Close quick react on click outside
  useEffect(() => {
    if (!showQuickReact) return;
    function handleClick(e: MouseEvent) {
      if (
        quickReactRef.current &&
        !quickReactRef.current.contains(e.target as Node)
      ) {
        setShowQuickReact(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showQuickReact]);

  const formattedTime = (() => {
    try {
      return format(new Date(timestamp), "HH:mm");
    } catch {
      return "";
    }
  })();

  const handleReactionClick = (emoji: string) => {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing && existing.userIds.includes(currentUserId)) {
      onRemoveReact(id, emoji);
    } else {
      onReact(id, emoji);
    }
  };

  const handleQuickReact = (emoji: string) => {
    onReact(id, emoji);
    setShowQuickReact(false);
  };

  const handleSheetReact = (emoji: string) => {
    onReact(id, emoji);
    closeActionSheet();
  };

  const handleSheetReply = () => {
    onReply(id);
    closeActionSheet();
  };

  const handleSheetEdit = () => {
    onEdit(id, content);
    closeActionSheet();
  };

  const handleSheetDelete = () => {
    closeActionSheet();
    onDelete(id);
  };

  // Deleted message
  if (isDeleted) {
    return (
      <div
        data-chat-message-id={id}
        className={`flex w-full min-w-0 ${isMine ? "justify-end" : "justify-start"} scroll-mt-24 px-4 py-0.5 transition-colors duration-300 ${
          highlighted ? "bg-command/10" : ""
        }`}
      >
        <div className={`px-3 py-1.5 rounded-xl bg-ink-surface2/50 text-ink-muted text-sm italic transition-shadow duration-300 lg:px-4 lg:py-2 lg:text-base ${
          highlighted ? "ring-2 ring-command/70" : ""
        }`}>
          {t("chat.deleted")}
        </div>
      </div>
    );
  }

  return (
    <div
      data-chat-message-id={id}
      className={`group flex w-full min-w-0 ${isMine ? "justify-end" : "justify-start"} scroll-mt-24 px-4 py-0.5 transition-colors duration-300 lg:px-6 lg:py-1 ${
        highlighted ? "bg-command/10" : ""
      }`}
    >
      <div
        className={`relative min-w-0 max-w-[88%] sm:max-w-[70%] lg:max-w-[68%] ${isMine ? "items-end" : "items-start"} flex flex-col px-3 py-2 -mx-3 -my-2 rounded-lg`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sender name */}
        {showSender && !isMine && senderName && (
          <div className="text-xs font-semibold text-ink-muted mb-0.5 px-1 lg:text-sm">
            {profileBasePath ? (
              <Link
                href={`${profileBasePath}/${senderId}`}
                className="hover:text-command transition-colors"
              >
                {senderEmoji && <span className="mr-1">{senderEmoji}</span>}
                {senderName}
                {senderRole && (
                  <span className="ml-1 text-[10px] font-normal opacity-60 lg:text-xs">
                    ({senderRole})
                  </span>
                )}
              </Link>
            ) : (
              <span>
                {senderEmoji && <span className="mr-1">{senderEmoji}</span>}
                {senderName}
                {senderRole && (
                  <span className="ml-1 text-[10px] font-normal opacity-60 lg:text-xs">
                    ({senderRole})
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <button
            type="button"
            onClick={() => onJumpToMessage?.(replyTo.id)}
            className={`mb-1 max-w-full rounded-md border-l-2 border-command/50 px-2 py-1 text-left text-xs text-ink-muted transition-colors lg:px-3 lg:py-1.5 lg:text-sm ${
              onJumpToMessage ? "cursor-pointer hover:bg-ink-surface2/80 hover:text-ink-text" : "cursor-default"
            }`}
            title={replyTo.content}
          >
            <span className="block truncate">
              <span className="font-semibold">{replyTo.senderName}</span>
              <span className="ml-1 opacity-70">{replyTo.content}</span>
            </span>
          </button>
        )}

        {/* Message bubble with hover actions */}
        <div
          className="relative flex min-w-0 max-w-full select-none flex-col [-webkit-touch-callout:none] sm:select-text"
          onTouchStart={handleTouchStart}
          onTouchEnd={clearLongPressTimer}
          onTouchCancel={clearLongPressTimer}
          onTouchMove={clearLongPressTimer}
          onContextMenu={handleContextMenu}
        >
          {/* Action bar */}
          <div
            className={`hidden items-center gap-0.5 rounded-md border border-ink-border bg-ink-surface2/95 p-0.5 shadow-crest backdrop-blur animate-in fade-in duration-100 lg:gap-1 lg:p-1 sm:absolute sm:top-0 sm:z-[99] ${
              hovered || showQuickReact ? "sm:flex" : "sm:hidden"
            } ${
              isMine
                ? "self-end sm:left-0 sm:-ml-2 sm:-translate-x-full"
                : "self-start sm:right-0 sm:ml-2 sm:translate-x-full"
            }`}
          >
            {/* React button */}
            <div className="relative" ref={quickReactRef}>
              <button
                type="button"
                onClick={() => setShowQuickReact(!showQuickReact)}
                className="w-8 h-8 sm:w-7 sm:h-7 lg:h-8 lg:w-8 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                title={t("chat.react")}
              >
                😀
              </button>

              {/* Quick react popup */}
              {showQuickReact && (
                <div className={`absolute bottom-full mb-1 ${isMine ? "right-0" : "left-0"} flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-x-auto bg-ink-surface border border-ink-border rounded-lg shadow-lg p-1 z-20 animate-in fade-in duration-100`}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleQuickReact(emoji)}
                      className="w-8 h-8 flex shrink-0 items-center justify-center rounded hover:bg-ink-border transition-colors text-base cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      setShowQuickReact(false);
                      const rect = e.currentTarget.getBoundingClientRect();
                      onOpenFullPicker(id, rect);
                    }}
                    className="w-8 h-8 flex shrink-0 items-center justify-center rounded hover:bg-ink-border transition-colors text-base text-ink-muted cursor-pointer"
                    title={t("chat.moreEmojis")}
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {/* Reply button */}
            <button
              type="button"
              onClick={() => onReply(id)}
              className="w-8 h-8 sm:w-7 sm:h-7 lg:h-8 lg:w-8 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
              title={t("chat.reply")}
            >
              ↩️
            </button>

            {/* Edit button (own messages only) */}
            {isMine && (
              <button
                type="button"
                onClick={() => onEdit(id, content)}
                className="w-8 h-8 sm:w-7 sm:h-7 lg:h-8 lg:w-8 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                title={t("chat.edit")}
              >
                ✏️
              </button>
            )}

            {/* Delete button (own messages, or house leader moderating) */}
            {(isMine || canModerate) && (
              <button
                type="button"
                onClick={() => onDelete(id)}
                className="w-8 h-8 sm:w-7 sm:h-7 lg:h-8 lg:w-8 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                title={t("chat.delete")}
              >
                🗑️
              </button>
            )}
          </div>

          {/* Bubble */}
          <div
            className={`order-1 min-w-0 max-w-full select-none rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap transition-shadow duration-300 lg:px-5 lg:py-3 lg:text-base lg:leading-7 sm:select-text ${
              highlighted ? "ring-2 ring-command/70 ring-offset-2 ring-offset-ink-surface" : ""
            } ${
              deliveryStatus === "sending" || deliveryStatus === "offline" ? "opacity-70" : ""
            } ${
              deliveryStatus === "failed" ? "ring-2 ring-danger/70" : ""
            } ${
              isMine
                ? "bg-command text-white rounded-br-md"
                : "bg-ink-surface2 text-ink-text rounded-bl-md"
            }`}
            style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
          >
            {previewMediaUrl && mediaUrl && mediaType === "image" && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="mb-2 block max-w-[75vw] sm:max-w-sm lg:max-w-md cursor-zoom-in overflow-hidden rounded-lg border border-white/10 bg-black/20"
              >
                <img
                  src={previewMediaUrl}
                  alt={t("chat.attachmentAlt")}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto object-cover max-h-60 lg:max-h-80"
                />
              </button>
            )}
            {mediaUrl && mediaType === "video" && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="relative mb-2 block max-w-[75vw] sm:max-w-sm lg:max-w-md cursor-zoom-in overflow-hidden rounded-lg border border-white/10 bg-black/20"
              >
                <video src={mediaUrl} muted playsInline preload="metadata" className="w-full h-auto max-h-60 lg:max-h-80 pointer-events-none" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-2xl text-white">▶</span>
                </span>
              </button>
            )}
            <ChatMarkdown content={content} settings={markdownSettings} />
            {(showTimestamp || editedAt) && (
              <span className="inline-flex items-center ml-2 gap-1 text-[10px] opacity-50 align-bottom lg:text-xs">
                {showTimestamp && formattedTime}
                {editedAt && <span>{t("chat.edited")}</span>}
              </span>
            )}
            {isMine && statusLabel && (
              <span
                className={`ml-2 inline-flex items-center gap-1 align-bottom text-[10px] lg:text-xs ${
                  deliveryStatus === "failed" ? "text-danger" : "opacity-60"
                }`}
                title={statusLabel}
              >
                {deliveryStatus === "sending" && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />}
                {deliveryStatus === "offline" && <span>...</span>}
                {deliveryStatus === "failed" && <span>!</span>}
                {deliveryStatus === "sent" && <span>✓</span>}
                {deliveryStatus === "read" && <span>✓✓</span>}
              </span>
            )}
          </div>
        </div>

        {deliveryStatus === "failed" && onRetrySend && (
          <button
            type="button"
            onClick={() => onRetrySend(id)}
            className="mt-1 px-2 text-xs font-medium text-danger underline-offset-2 hover:underline lg:text-sm"
          >
            {t("chat.retry")}
          </button>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1 lg:gap-1.5">
            {reactions.map((reaction) => {
              const hasReacted = reaction.userIds.includes(currentUserId);
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => handleReactionClick(reaction.emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-pointer transition-colors lg:px-2.5 lg:py-1 lg:text-sm ${
                    hasReacted
                      ? "border-command bg-command/10 text-command"
                      : "border-ink-border hover:border-command/50"
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lightboxOpen && mediaUrl && mediaType && (
        <MediaLightbox
          url={mediaUrl}
          type={mediaType}
          alt={t("chat.attachmentAlt")}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {actionSheetOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/65 px-3 pb-3 pt-16 backdrop-blur-sm sm:hidden"
            onClick={closeActionSheet}
          >
            <div
              className="max-h-[85svh] w-full max-w-sm overflow-y-auto rounded-2xl border border-ink-border bg-ink-surface shadow-crest"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-ink-border p-3">
                <p className="text-xs font-semibold text-ink-muted">
                  {senderName ?? t("common.you")} · {formattedTime}
                </p>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink-text">
                  {content || (mediaType === "video" ? t("chat.mediaVideo") : t("chat.mediaImage"))}
                </p>
              </div>

              <div className="grid grid-cols-6 gap-1 border-b border-ink-border p-2">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSheetReact(emoji)}
                    className="flex h-11 items-center justify-center rounded-xl bg-ink-surface2 text-xl transition-colors hover:bg-ink-border"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  onClick={handleSheetReply}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-surface2 px-3 text-sm font-medium"
                >
                  <span>↩️</span>
                  {t("chat.reply")}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSheetEmojiPicker((value) => !value)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-surface2 px-3 text-sm font-medium"
                >
                  <span>😀</span>
                  {t("chat.moreEmojis")}
                </button>

                {isMine && (
                  <button
                    type="button"
                    onClick={handleSheetEdit}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-surface2 px-3 text-sm font-medium"
                  >
                    <span>✏️</span>
                    {t("chat.edit")}
                  </button>
                )}

                {(isMine || canModerate) && (
                  <button
                    type="button"
                    onClick={handleSheetDelete}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 text-sm font-medium text-danger"
                  >
                    <span>🗑️</span>
                    {t("chat.delete")}
                  </button>
                )}
              </div>

              {showSheetEmojiPicker && (
                <div className="border-t border-ink-border p-2">
                  <EmojiPicker
                    positionClass="relative mx-auto"
                    onSelect={handleSheetReact}
                    onClose={() => setShowSheetEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
