"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from "react";
import EmojiPicker from "./EmojiPicker";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = createClient();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, [supabase]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (50MB max)
    if (file.size > 52428800) {
      setErrorMsg("File quá lớn. Giới hạn tối đa là 50MB.");
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
        setErrorMsg("Không thể tải tệp lên. Vui lòng thử lại.");
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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

      {/* Media Upload Preview Bar */}
      {mediaPreview && (
        <div className="bg-ink-surface2 border-b border-ink-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mediaPreview.type === "image" ? (
              <img
                src={mediaPreview.url}
                alt="Upload preview"
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
            title="Gỡ bỏ"
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
      {errorMsg && (
        <div className="bg-danger/10 border-b border-danger/20 px-3 py-1.5 flex items-center justify-between text-xs text-danger">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="hover:opacity-80">✕</button>
        </div>
      )}

      {/* Input row */}
      <div className="p-3 flex items-center gap-2">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*"
          className="hidden"
          disabled={disabled || uploading || isEditing}
        />

        {/* Upload Attachment Button */}
        <button
          type="button"
          onClick={triggerFileSelect}
          className="p-2 rounded-lg hover:bg-ink-surface2 transition-colors text-lg text-ink-muted hover:text-ink-text cursor-pointer disabled:opacity-40"
          title="Đính kèm ảnh/video"
          disabled={disabled || uploading || isEditing}
        >
          📎
        </button>

        {/* Emoji picker toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-lg hover:bg-ink-surface2 transition-colors text-lg cursor-pointer disabled:opacity-40"
            title="Emoji"
            disabled={disabled || uploading}
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
          placeholder={uploading ? "Đang tải tệp lên..." : placeholder}
          disabled={disabled || uploading}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors placeholder:text-ink-muted disabled:opacity-50"
        />

        {/* Send / Save button */}
        <button
          type="button"
          onClick={handleSendClick}
          disabled={disabled || uploading || (!value.trim() && !selectedFile)}
          className="px-4 py-2.5 rounded-lg bg-command hover:bg-command/85 disabled:opacity-40 transition-colors font-semibold text-sm text-white cursor-pointer disabled:cursor-not-allowed flex items-center justify-center min-w-[50px]"
        >
          {uploading ? (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : isEditing ? (
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
