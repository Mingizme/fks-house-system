"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

export interface MuteStatus {
  muted_until: string | null;
  muted_by: string | null;
  mute_reason: string | null;
  muted_by_name: string | null;
  chat_banned_at?: string | null;
  chat_banned_by?: string | null;
  chat_ban_reason?: string | null;
  chat_banned_by_name?: string | null;
  account_banned_at?: string | null;
  account_banned_by?: string | null;
  account_ban_reason?: string | null;
  account_banned_by_name?: string | null;
}

type ProfileModerationRow = Omit<
  MuteStatus,
  "muted_by_name" | "chat_banned_by_name" | "account_banned_by_name"
>;

function toRestrictionStatus(row: ProfileModerationRow | null): MuteStatus | null {
  if (!row) return null;
  const mutedActive = row.muted_until ? new Date(row.muted_until) > new Date() : false;
  const chatBanned = !!row.chat_banned_at;
  const accountBanned = !!row.account_banned_at;
  if (!mutedActive && !chatBanned && !accountBanned) return null;

  return {
    ...row,
    muted_by_name: null,
    chat_banned_by_name: null,
    account_banned_by_name: null,
  };
}

/**
 * Hook kiểm tra trạng thái mute của user hiện tại + lắng nghe realtime.
 * Tự re-check mỗi 30s để lazy unmute khi hết hạn.
 */
export function useMuteStatus(
  userId: string,
  houseId: string | null,
  initialStatus: MuteStatus | null = null
): { isMuted: boolean; muteStatus: MuteStatus | null; refetch: () => void } {
  const supabase = createClient();
  const [muteStatus, setMuteStatus] = useState<MuteStatus | null>(initialStatus);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select(
        "muted_until, muted_by, mute_reason, chat_banned_at, chat_banned_by, chat_ban_reason, account_banned_at, account_banned_by, account_ban_reason"
      )
      .eq("id", userId)
      .single()
      .then(async ({ data, error }) => {
        if (!error) {
          setMuteStatus(toRestrictionStatus(data as ProfileModerationRow | null));
        } else {
          const { data: legacyData, error: legacyError } = await supabase
            .from("profiles")
            .select("muted_until, muted_by, mute_reason")
            .eq("id", userId)
            .single();
          setMuteStatus(
            legacyError ? null : toRestrictionStatus(legacyData as ProfileModerationRow | null)
          );
        }
      });
  }, [supabase, userId]);

  // Re-check định kỳ để lazy unmute
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch ban đầu + mỗi tick
  useEffect(() => {
    refetch();
  }, [refetch, tick]);

  // Realtime: lắng nghe UPDATE trên profiles row của user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`mute-watch-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload: any) => {
          const newRow = payload.new;
          setMuteStatus(toRestrictionStatus(newRow as ProfileModerationRow | null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, houseId]);

  // Kiểm tra còn hạn không (lazy)
  const isMuted =
    (muteStatus?.muted_until != null && new Date(muteStatus.muted_until) > new Date()) ||
    !!muteStatus?.chat_banned_at ||
    !!muteStatus?.account_banned_at;

  return { isMuted, muteStatus, refetch };
}

function formatRemaining(until: string): string {
  const diffMs = new Date(until).getTime() - Date.now();
  if (diffMs <= 0) return "0m";
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${minutes}m`;
}

/**
 * Banner cảnh báo "Bạn đang bị mute" hiển thị phía trên khung chat.
 */
export function MuteBanner({ muteStatus }: { muteStatus: MuteStatus | null }) {
  const { t } = useI18n();
  const mutedActive = muteStatus?.muted_until ? new Date(muteStatus.muted_until) > new Date() : false;
  const chatBanned = !!muteStatus?.chat_banned_at;
  const accountBanned = !!muteStatus?.account_banned_at;
  if (!mutedActive && !chatBanned && !accountBanned) return null;

  const remaining = muteStatus?.muted_until ? formatRemaining(muteStatus.muted_until) : "";
  const byName = muteStatus?.muted_by_name ? t("common.by", { name: muteStatus.muted_by_name }) : "";
  const reason =
    muteStatus?.account_ban_reason ?? muteStatus?.chat_ban_reason ?? muteStatus?.mute_reason;
  const title = accountBanned
    ? t("chat.accountBannedMessage")
    : chatBanned
    ? t("chat.chatBannedMessage")
    : `${t("chat.mutedMessage")} · ${t("chat.mutedRemaining", { duration: remaining })}`;

  return (
    <div className="px-3 py-2 bg-warning/10 border-b border-warning/30 flex items-center gap-2">
      <span className="text-base">🔕</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-warning">
          {title}
        </p>
        {reason && (
          <p className="text-[11px] text-ink-muted truncate">
            {t("chat.muteReason")}: {reason}
            {byName ? ` · ${byName}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
