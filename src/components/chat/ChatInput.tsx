"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import EmojiPicker from "./EmojiPicker";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  replyingTo?: { id: string; content: string; senderName: string } | null;
  onCancelReply?: () => void;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Nhập tin nhắn...",
  sendLabel,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}: ChatInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!inputRef.current) {
        onChange(value + emoji);
        return;
      }

      const start = inputRef.current.selectionStart ?? value.length;
      const end = inputRef.current.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + emoji + value.slice(end);
      onChange(newValue);

      // Restore cursor position after emoji insertion
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const pos = start + emoji.length;
          inputRef.current.setSelectionRange(pos, pos);
          inputRef.current.focus();
        }
      });
    },
    [value, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage && onSaveEdit) {
        onSaveEdit();
      } else {
        onSend();
      }
    }
  };

  const handleSendClick = () => {
    if (editingMessage && onSaveEdit) {
      onSaveEdit();
    } else {
      onSend();
    }
  };

  const isEditing = !!editingMessage;

  return (
    <div className="border-t border-ink-border">
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-ink-surface2 border-b border-ink-border px-3 py-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-0.5 h-5 bg-command/50 rounded-full flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-command truncate">
                {replyingTo.senderName}
              </p>
              <p className="text-xs text-ink-muted truncate">
                {replyingTo.content}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="ml-2 p-1 rounded hover:bg-ink-border transition-colors text-ink-muted hover:text-ink-text flex-shrink-0 cursor-pointer"
            title="Cancel reply"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Edit indicator bar */}
      {isEditing && (
        <div className="flex items-center justify-between bg-ink-surface2 border-b border-ink-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">✏️</span>
            <span className="text-xs font-semibold text-command">
              Editing message
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="ml-2 p-1 rounded hover:bg-ink-border transition-colors text-ink-muted hover:text-ink-text cursor-pointer"
            title="Cancel edit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="p-3 flex items-center gap-2">
        {/* Emoji picker toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-lg hover:bg-ink-surface2 transition-colors text-lg cursor-pointer"
            title="Emoji"
          >
            😀
          </button>
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={(emoji) => {
                handleEmojiSelect(emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors placeholder:text-ink-muted disabled:opacity-50"
        />

        {/* Send / Save button */}
        <button
          type="button"
          onClick={handleSendClick}
          disabled={disabled || !value.trim()}
          className="px-4 py-2.5 rounded-lg bg-command hover:bg-command/85 disabled:opacity-40 transition-colors font-semibold text-sm text-white cursor-pointer disabled:cursor-not-allowed"
        >
          {isEditing ? (
            /* Save icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            sendLabel || "Gửi"
          )}
        </button>
      </div>
    </div>
  );
}
