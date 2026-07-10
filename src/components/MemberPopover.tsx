"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

interface MemberPopoverProps {
  memberId: string;
  displayName: string;
  avatarEmoji: string | null;
  /** Optional leadership label, e.g. "House Master" */
  roleLabel?: string | null;
  /** Base path for messages, e.g. "/messages" or "/admin/messages" */
  messagesBasePath: string;
  /** Base path for profile, e.g. "/profile" or "/admin/profile" */
  profileBasePath: string;
  /** Current user id; hide "message self" */
  currentUserId: string;
  /** Optional extra tail slot (e.g. AdminMuteControl) */
  extraSlot?: React.ReactNode;
  /** Optional presence dot id (omit to disable presence indicator) */
  presenceDot?: boolean;
}

export function MemberPopover({
  memberId,
  displayName,
  avatarEmoji,
  roleLabel,
  messagesBasePath,
  profileBasePath,
  currentUserId,
  extraSlot,
  presenceDot,
}: MemberPopoverProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const hasExtraSlot = Boolean(extraSlot);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 16, Math.max(hasExtraSlot ? 300 : 220, rect.width));
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const estimatedHeight = hasExtraSlot ? 420 : 132;
      const top =
        rect.bottom + estimatedHeight + 8 > window.innerHeight
          ? Math.max(8, rect.top - estimatedHeight - 6)
          : rect.bottom + 6;

      setMenuPosition({ top, left, width });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, hasExtraSlot]);

  const isSelf = memberId === currentUserId;
  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            style={menuPosition}
            className="fixed z-50 max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-ink-border bg-ink-surface shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="p-3 border-b border-ink-border">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              {roleLabel && <p className="text-xs text-success font-mono mt-0.5">{roleLabel}</p>}
            </div>
            <div className="p-1.5 space-y-0.5">
              <Link
                href={`${profileBasePath}/${memberId}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-ink-surface2 transition-colors"
                onClick={() => setOpen(false)}
              >
                <span className="w-4 text-center">{"\u{1F464}"}</span>
                {t("member.viewProfile")}
              </Link>
              {!isSelf && (
                <Link
                  href={`${messagesBasePath}/${memberId}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-ink-surface2 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <span className="w-4 text-center">💬</span>
                  {t("member.directMessage")}
                </Link>
              )}
              {extraSlot && <div className="px-1.5 pt-1.5 border-t border-ink-border">{extraSlot}</div>}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-ink-surface2 w-full text-left transition-colors"
      >
        <span>{avatarEmoji ?? "\u{1F642}"}</span>
        <span className="text-sm truncate">{displayName}</span>
        {roleLabel && (
          <span className="ml-auto shrink-0 text-[10px] font-mono text-success bg-success/10 border border-success/30 rounded px-1.5 py-0.5">
            {roleLabel}
          </span>
        )}
        {presenceDot && <PresenceDotOverlay memberId={memberId} />}
      </button>

      {menu}
    </div>
  );
}

/**
 * Wrapper chịu lỗi khi PresenceProvider chưa được wrap (return null).
 */
function PresenceDotOverlay({ memberId }: { memberId: string }) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { usePresence } = require("@/components/PresenceProvider");
    const { isOnline }: { isOnline: (id: string) => boolean } = usePresence();
    const online = isOnline(memberId);
    return (
      <span
        className={`ml-1 h-2 w-2 rounded-full inline-block shrink-0 ${online ? "bg-success" : "bg-ink-faint"}`}
      />
    );
  } catch {
    return null;
  }
}
