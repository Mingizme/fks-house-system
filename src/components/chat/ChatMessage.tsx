"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import EmojiPicker from "./EmojiPicker";

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
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
  onOpenFullPicker: (messageId: string, buttonRect: DOMRect) => void;
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
  mediaUrl,
  mediaType,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRemoveReact,
  onOpenFullPicker,
}: ChatMessageProps) {
  const [hovered, setHovered] = useState(false);
  const [showQuickReact, setShowQuickReact] = useState(false);
  const quickReactRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (cancelActiveHover === closeHover) {
        cancelActiveHover = null;
      }
    };
  }, [closeHover]);

  const isMine = senderId === currentUserId;
  const isDeleted = !!deletedAt;

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

  // Deleted message
  if (isDeleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-4 py-0.5`}>
        <div className="px-3 py-1.5 rounded-xl bg-ink-surface2/50 text-ink-muted text-sm italic">
          Tin nhắn đã bị xóa
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex ${isMine ? "justify-end" : "justify-start"} px-4 py-0.5`}
    >
      <div 
        className={`relative max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col p-3 -m-3`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sender name */}
        {showSender && !isMine && senderName && (
          <div className="text-xs font-semibold text-ink-muted mb-0.5 px-1">
            {profileBasePath ? (
              <Link
                href={`${profileBasePath}/${senderId}`}
                className="hover:text-command transition-colors"
              >
                {senderEmoji && <span className="mr-1">{senderEmoji}</span>}
                {senderName}
                {senderRole && (
                  <span className="ml-1 text-[10px] font-normal opacity-60">
                    ({senderRole})
                  </span>
                )}
              </Link>
            ) : (
              <span>
                {senderEmoji && <span className="mr-1">{senderEmoji}</span>}
                {senderName}
                {senderRole && (
                  <span className="ml-1 text-[10px] font-normal opacity-60">
                    ({senderRole})
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="border-l-2 border-command/50 pl-2 text-xs text-ink-muted truncate mb-1 max-w-full">
            <span className="font-semibold">{replyTo.senderName}</span>
            <span className="ml-1 opacity-70">{replyTo.content}</span>
          </div>
        )}

        {/* Message bubble with hover actions */}
        <div className="relative">
          {/* Action bar */}
          {hovered && (
            <div
              className="absolute -top-6 right-2 flex items-center gap-0.5 bg-ink-surface border border-ink-border rounded-lg shadow-lg p-0.5 z-[99] animate-in fade-in duration-100"
            >
              {/* React button */}
              <div className="relative" ref={quickReactRef}>
                <button
                  type="button"
                  onClick={() => setShowQuickReact(!showQuickReact)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                  title="React"
                >
                  😀
                </button>

                {/* Quick react popup */}
                {showQuickReact && (
                  <div className={`absolute bottom-full mb-1 ${isMine ? "right-0" : "left-0"} flex items-center gap-0.5 bg-ink-surface border border-ink-border rounded-lg shadow-lg p-1 z-20 animate-in fade-in duration-100`}>
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleQuickReact(emoji)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-base cursor-pointer"
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
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-base text-ink-muted cursor-pointer"
                      title="More emojis"
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
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                title="Reply"
              >
                ↩️
              </button>

              {/* Edit button (own messages only) */}
              {isMine && (
                <button
                  type="button"
                  onClick={() => onEdit(id, content)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                  title="Edit"
                >
                  ✏️
                </button>
              )}

              {/* Delete button (own messages only) */}
              {isMine && (
                <button
                  type="button"
                  onClick={() => onDelete(id)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-ink-border transition-colors text-sm cursor-pointer"
                  title="Delete"
                >
                  🗑️
                </button>
              )}
            </div>
          )}

          {/* Bubble */}
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
              isMine
                ? "bg-command text-white rounded-br-md"
                : "bg-ink-surface2 text-ink-text rounded-bl-md"
            }`}
          >
            {mediaUrl && mediaType === "image" && (
              <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-white/10 bg-black/20">
                <img src={mediaUrl} alt="Attachment" className="w-full h-auto object-cover max-h-60" />
              </div>
            )}
            {mediaUrl && mediaType === "video" && (
              <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-white/10 bg-black/20">
                <video src={mediaUrl} controls className="w-full h-auto max-h-60" />
              </div>
            )}
            {content}
            <span className="inline-flex items-center ml-2 gap-1 text-[10px] opacity-50 align-bottom">
              {formattedTime}
              {editedAt && <span>(edited)</span>}
            </span>
          </div>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {reactions.map((reaction) => {
              const hasReacted = reaction.userIds.includes(currentUserId);
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => handleReactionClick(reaction.emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-pointer transition-colors ${
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
    </div>
  );
}
