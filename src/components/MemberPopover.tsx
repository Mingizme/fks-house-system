"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

interface MemberPopoverProps {
  memberId: string;
  displayName: string;
  avatarEmoji: string | null;
  /** Base path for messages, e.g. "/messages" or "/admin/messages" */
  messagesBasePath: string;
  /** Base path for profile, e.g. "/profile" or "/admin/profile" */
  profileBasePath: string;
  /** Current user id — hide "message self" */
  currentUserId: string;
}

export function MemberPopover({
  memberId,
  displayName,
  avatarEmoji,
  messagesBasePath,
  profileBasePath,
  currentUserId,
}: MemberPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isSelf = memberId === currentUserId;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-ink-surface2 w-full text-left transition-colors"
      >
        <span>{avatarEmoji ?? "🙂"}</span>
        <span className="text-sm truncate">{displayName}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-ink-border bg-ink-surface shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3 border-b border-ink-border">
            <p className="text-sm font-semibold truncate">{displayName}</p>
          </div>
          <div className="p-1.5 space-y-0.5">
            <Link
              href={`${profileBasePath}/${memberId}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-ink-surface2 transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="w-4 text-center">👤</span>
              {t("member.viewProfile")}
            </Link>
            {!isSelf && (
              <>
                <Link
                  href={`${messagesBasePath}/${memberId}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-ink-surface2 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <span className="w-4 text-center">💬</span>
                  {t("member.directMessage")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
