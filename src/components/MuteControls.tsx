"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

export interface MuteStatus {
  muted_until: string | null;
  muted_by: string | null;
  mute_reason: string | null;
  muted_by_name: string | null;
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
      .rpc("get_mute_status", { user_id: userId })
      .then(({ data, error }) => {
        if (!error && data && (data as any).muted_until) {
          setMuteStatus(data as MuteStatus);
        } else {
          setMuteStatus(null);
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
          const until = newRow?.muted_until;
          if (until && new Date(until) > new Date()) {
            setMuteStatus({
              muted_until: until,
              muted_by: newRow.muted_by,
              mute_reason: newRow.mute_reason,
              muted_by_name: null,
            });
            // Lấy tên muted_by_name
            if (newRow.muted_by) {
              supabase
                .from("profiles")
                .select("display_name")
                .eq("id", newRow.muted_by)
                .single()
                .then(({ data }) => {
                  setMuteStatus((prev) =>
                    prev ? { ...prev, muted_by_name: data?.display_name ?? null } : prev
                  );
                });
            }
          } else {
            setMuteStatus(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, houseId]);

  // Kiểm tra còn hạn không (lazy)
  const isMuted =
    muteStatus?.muted_until != null && new Date(muteStatus.muted_until) > new Date();

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
  if (!muteStatus?.muted_until || new Date(muteStatus.muted_until) <= new Date()) return null;

  const remaining = formatRemaining(muteStatus.muted_until);
  const byName = muteStatus.muted_by_name ? t("common.by", { name: muteStatus.muted_by_name }) : "";

  return (
    <div className="px-3 py-2 bg-warning/10 border-b border-warning/30 flex items-center gap-2">
      <span className="text-base">🔕</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-warning">
          {t("chat.mutedMessage")} · {t("chat.mutedRemaining", { duration: remaining })}
        </p>
        {muteStatus.mute_reason && (
          <p className="text-[11px] text-ink-muted truncate">
            {t("chat.muteReason")}: {muteStatus.mute_reason}
            {byName ? ` · ${byName}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
