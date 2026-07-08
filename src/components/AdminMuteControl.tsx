"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import { PresenceDot } from "@/components/PresenceDot";
import type { TranslationKey } from "@/lib/i18n";

interface Props {
  targetId: string;
  targetName: string;
  targetEmoji: string | null;
  blocked: boolean | null;
  /** muted_until nếu đang bị mute (để hiển thị trạng thái) */
  mutedUntil?: string | null;
  muteReason?: string | null;
  /** admin có quyền mute target không (UI hint) */
  canMute: boolean;
}

const DURATION_OPTIONS: Array<{ value: number; labelKey: TranslationKey }> = [
  { value: 5, labelKey: "chat.muteDuration.5m" },
  { value: 15, labelKey: "chat.muteDuration.15m" },
  { value: 60, labelKey: "chat.muteDuration.1h" },
  { value: 180, labelKey: "chat.muteDuration.3h" },
  { value: 720, labelKey: "chat.muteDuration.12h" },
  { value: 1440, labelKey: "chat.muteDuration.1d" },
  { value: 4320, labelKey: "chat.muteDuration.3d" },
  { value: 10080, labelKey: "chat.muteDuration.7d" },
];

/**
 * Dòng mute control gắn vào MemberPopover hoặc danh sách quản lý.
 * - Nếu target đang bị mute: hiển thị "X gỡ mute" và thời hạn còn lại.
 * - Nếu admin có quyền: hiển thị dropdown chọn thời hạn + ô lý do + nút mute.
 */
export function AdminMuteControl({
  targetId,
  targetName,
  targetEmoji,
  blocked,
  mutedUntil,
  muteReason,
  canMute,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [duration, setDuration] = useState<number>(60);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!canMute) return null;

  const isMuted = mutedUntil ? new Date(mutedUntil) > new Date() : false;

  async function doMute() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc("mute_user", {
      target_id: targetId,
      duration_minutes: duration,
      reason: reason.trim() || null,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setSuccess(t("chat.mutedSuccess"));
      setReason("");
      setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    }
  }

  async function doUnmute() {
    setLoading(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("unmute_user", { target_id: targetId });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setSuccess(t("chat.unmutedSuccess"));
      setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-ink-border bg-ink-surface2 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{targetEmoji ?? "🙂"}</span>
        <span className="text-sm font-medium truncate flex-1">{targetName}</span>
        <PresenceDot userId={targetId} />
      </div>

      {isMuted ? (
        <div className="space-y-2">
          <p className="text-xs text-warning font-mono">
            {t("chat.mutedMessage")} {mutedUntil && `· ${new Date(mutedUntil).toLocaleString()}`}
          </p>
          {muteReason && <p className="text-[11px] text-ink-muted">{t("chat.muteReason")}: {muteReason}</p>}
          <button
            type="button"
            onClick={doUnmute}
            disabled={loading}
            className="w-full rounded-lg border border-success/40 text-success hover:bg-success/10 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {loading ? t("common.saving") : t("chat.unmuteUser")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={loading}
              aria-label={t("chat.muteDurationLabel")}
              className="flex-1 rounded-md bg-ink-surface border border-ink-border px-2 py-1.5 text-xs outline-none focus:border-command"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={doMute}
              disabled={loading}
              className="rounded-md bg-warning/15 border border-warning/40 text-warning hover:bg-warning/25 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loading ? t("common.saving") : `🔕 ${t("chat.muteUser")}`}
            </button>
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            maxLength={200}
            placeholder={t("chat.muteReasonPlaceholder")}
            className="w-full rounded-md bg-ink-surface border border-ink-border px-2 py-1.5 text-xs outline-none focus:border-command"
          />
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">{success}</p>}
      {blocked && <p className="text-[10px] text-ink-faint font-mono">{t("chat.mutedBlockedHint")}</p>}
    </div>
  );
}
