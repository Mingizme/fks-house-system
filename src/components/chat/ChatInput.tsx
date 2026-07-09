"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect, useMemo } from "react";
import EmojiPicker from "./EmojiPicker";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (mediaUrl?: string | null, mediaType?: "image" | "video" | null) => void;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  replyingTo?: { id: string; content: string; senderName: string } | null;
  onCancelReply?: () => void;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  maxWords?: number;
}

const MAX_TEXTAREA_HEIGHT = 160;

function countWords(value: string) {
  return value.trim().match(/\S+/g)?.length ?? 0;
}

function limitToWords(value: string, limit: number) {
  const chunks = value.match(/\S+\s*/g);
  if (!chunks || chunks.length <= limit) {
    return { value, limited: false };
  }

  return {
    value: chunks.slice(0, limit).join("").trimEnd(),
    limited: true,
  };
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder,
  sendLabel,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  maxWords,
}: ChatInputProps) {
  const supabase = createClient();
  const { t } = useI18n();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wordLimitNotice, setWordLimitNotice] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectivePlaceholder = placeholder ?? t("messages.placeholder");
  const activeWordLimit = typeof maxWords === "number" && maxWords > 0 ? maxWords : null;
  const wordCount = useMemo(() => countWords(value), [value]);
  const showWordCounter =
    activeWordLimit !== null && (wordCount >= Math.floor(activeWordLimit * 0.8) || wordLimitNotice);
  const activeError =
    errorMsg ??
    (wordLimitNotice && activeWordLimit !== null
      ? t("chat.wordLimitReached", { limit: activeWordLimit })
      : null);
  const isEditing = !!editingMessage;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, [supabase]);

  useEffect(() => {
    if (activeWordLimit === null || wordCount < activeWordLimit) {
      setWordLimitNotice(false);
    }
  }, [activeWordLimit, wordCount]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";

    if (el.scrollHeight > MAX_TEXTAREA_HEIGHT) {
      el.scrollTop = el.scrollHeight;
    }
  }, [value, replyingTo, isEditing, mediaPreview, activeError]);

  const applyTextChange = useCallback(
    (nextValue: string) => {
      if (activeWordLimit === null) {
        onChange(nextValue);
        return nextValue;
      }

      const result = limitToWords(nextValue, activeWordLimit);
      onChange(result.value);
      setWordLimitNotice(result.limited);
      return result.value;
    },
    [activeWordLimit, onChange]
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!inputRef.current) {
        applyTextChange(value + emoji);
        return;
      }

      const start = inputRef.current.selectionStart ?? value.length;
      const end = inputRef.current.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + emoji + value.slice(end);
      const appliedValue = applyTextChange(newValue);

      // Restore cursor position after emoji insertion
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const pos = Math.min(start + emoji.length, appliedValue.length);
          inputRef.current.setSelectionRange(pos, pos);
          inputRef.current.focus();
        }
      });
    },
    [value, applyTextChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (50MB max)
    if (file.size > 52428800) {
      setErrorMsg(t("chat.fileTooLarge"));
      return;
    }

    const fileType = file.type.startsWith("video/") ? "video" : "image";
    setSelectedFile(file);
    setMediaPreview({
      url: URL.createObjectURL(file),
      type: fileType,
    });
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadAndSend = async () => {
    if (uploading || disabled) return;

    let mediaUrl: string | null = null;
    let mediaType: "image" | "video" | null = null;

    if (selectedFile && currentUserId) {
      setUploading(true);
      setErrorMsg(null);
      try {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, selectedFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage
          .from("attachments")
          .getPublicUrl(fileName);

        mediaUrl = data.publicUrl;
        mediaType = selectedFile.type.startsWith("video/") ? "video" : "image";
      } catch (err: any) {
        console.error("Upload error:", err);
        setErrorMsg(t("chat.uploadFailed"));
        setUploading(false);
        return;
      }
    }

    onSend(mediaUrl, mediaType);
    setSelectedFile(null);
    setMediaPreview(null);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage && onSaveEdit) {
        onSaveEdit();
      } else {
        handleUploadAndSend();
      }
    }
  };

  const handleSendClick = () => {
    if (editingMessage && onSaveEdit) {
      onSaveEdit();
    } else {
      handleUploadAndSend();
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 bg-ink-surface">
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-ink-surface2 border border-b-0 border-ink-border rounded-t-xl px-3 py-2">
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
            title={t("chat.cancelReply")}
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
        <div className="flex items-center justify-between bg-ink-surface2 border border-b-0 border-ink-border rounded-t-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">✏️</span>
            <span className="text-xs font-semibold text-command">
              {t("chat.editingMessage")}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="ml-2 p-1 rounded hover:bg-ink-border transition-colors text-ink-muted hover:text-ink-text cursor-pointer"
            title={t("chat.cancelEdit")}
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

      {/* Media Upload Preview Bar */}
      {mediaPreview && (
        <div className="bg-ink-surface2 border border-b-0 border-ink-border rounded-t-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mediaPreview.type === "image" ? (
              <img
                src={mediaPreview.url}
                alt={t("chat.attachmentAlt")}
                className="w-16 h-16 object-cover rounded-lg border border-ink-border bg-black/10"
              />
            ) : (
              <video
                src={mediaPreview.url}
                className="w-16 h-16 object-cover rounded-lg border border-ink-border bg-black/10"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate text-ink-text">
                {selectedFile?.name}
              </p>
              <p className="text-[10px] text-ink-muted">
                {selectedFile && (selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-1 rounded-full bg-ink-surface border border-ink-border text-ink-muted hover:text-ink-text hover:bg-ink-border cursor-pointer transition-colors"
            title={t("chat.removeAttachment")}
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

      {/* Error Message Bar */}
      {activeError && (
        <div className="bg-danger/10 border border-b-0 border-danger/20 rounded-t-xl px-3 py-1.5 flex items-center justify-between text-xs text-danger">
          <span>{activeError}</span>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setWordLimitNotice(false);
            }}
            className="hover:opacity-80"
          >
            x
          </button>
        </div>
      )}

      {/* Main Input Container styled like Discord */}
      <div 
        className={`flex items-end gap-3 bg-ink-surface2/60 hover:bg-ink-surface2/80 border border-ink-border px-4 py-2.5 transition-colors ${
          replyingTo || isEditing || mediaPreview || activeError ? "rounded-b-xl border-t-0" : "rounded-xl"
        }`}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*"
          className="hidden"
          disabled={disabled || uploading || isEditing}
        />

        {/* Upload Attachment Button (Discord style circular + button) */}
        <button
          type="button"
          onClick={triggerFileSelect}
          className="mt-0.5 w-6 h-6 flex shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-ink-text font-bold text-base cursor-pointer disabled:opacity-40 transition-colors"
          title={t("chat.attachMedia")}
          disabled={disabled || uploading || isEditing}
        >
          +
        </button>

        {/* Text input grows until max height, then scrolls like Discord. */}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => applyTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? t("chat.uploadingFile") : effectivePlaceholder}
          disabled={disabled || uploading}
          rows={1}
          className="min-h-[24px] max-h-[160px] flex-1 resize-none bg-transparent border-0 outline-none text-sm leading-6 placeholder:text-ink-muted disabled:opacity-50 focus:ring-0 focus:outline-none overflow-y-hidden"
        />

        {showWordCounter && activeWordLimit !== null && (
          <span
            className={`pb-0.5 text-[10px] font-mono shrink-0 ${
              wordCount >= activeWordLimit ? "text-danger" : "text-ink-muted"
            }`}
          >
            {wordCount}/{activeWordLimit}
          </span>
        )}

        {/* Emoji picker toggle on the right side of the text input */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-lg leading-none cursor-pointer disabled:opacity-40"
            title="Emoji"
            disabled={disabled || uploading}
          >
            😀
          </button>
          {showEmojiPicker && (
            <EmojiPicker
              positionClass="absolute bottom-full mb-2 right-0"
              onSelect={(emoji) => {
                handleEmojiSelect(emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>

        {/* Send / Save icon (clean SVG paper-plane icon) */}
        <button
          type="button"
          onClick={handleSendClick}
          disabled={disabled || uploading || (!value.trim() && !selectedFile)}
          aria-label={isEditing ? t("chat.save") : sendLabel ?? t("common.send")}
          title={isEditing ? t("chat.save") : sendLabel ?? t("common.send")}
          className="p-1.5 rounded-lg text-command hover:bg-command/10 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed flex shrink-0 items-center justify-center"
        >
          {uploading ? (
            <svg className="animate-spin h-5 w-5 text-command" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : isEditing ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-45 -mr-0.5">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
