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
  mutedUntil?: string | null;
  muteReason?: string | null;
  chatBannedAt?: string | null;
  chatBanReason?: string | null;
  accountBannedAt?: string | null;
  accountBanReason?: string | null;
  lastSeenIp?: string | null;
  ipBannedAt?: string | null;
  ipBanReason?: string | null;
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

export function AdminMuteControl({
  targetId,
  targetName,
  targetEmoji,
  blocked,
  mutedUntil,
  muteReason,
  chatBannedAt,
  chatBanReason,
  accountBannedAt,
  accountBanReason,
  lastSeenIp,
  ipBannedAt,
  ipBanReason,
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
  const isChatBanned = !!chatBannedAt;
  const isAccountBanned = !!accountBannedAt;
  const isIpBanned = !!ipBannedAt;

  async function runAction(action: () => PromiseLike<{ error: any }>, successMessage: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await action();
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSuccess(successMessage);
    setReason("");
    setTimeout(() => setSuccess(null), 2500);
    router.refresh();
  }

  async function doMute() {
    await runAction(
      () =>
        supabase.rpc("mute_user", {
          target_id: targetId,
          duration_minutes: duration,
          reason: reason.trim() || null,
        }),
      t("chat.mutedSuccess")
    );
  }

  async function doUnmute() {
    await runAction(
      () => supabase.rpc("unmute_user", { target_id: targetId }),
      t("chat.unmutedSuccess")
    );
  }

  async function doChatBan() {
    await runAction(
      () => supabase.rpc("ban_chat_user", { target_id: targetId, reason: reason.trim() || null }),
      t("moderation.chatBannedSuccess")
    );
  }

  async function doChatUnban() {
    await runAction(
      () => supabase.rpc("unban_chat_user", { target_id: targetId }),
      t("moderation.chatUnbannedSuccess")
    );
  }

  async function doAccountBan() {
    if (!window.confirm(t("moderation.confirmAccountBan", { name: targetName }))) return;
    await runAction(
      () => supabase.rpc("ban_account_user", { target_id: targetId, reason: reason.trim() || null }),
      t("moderation.accountBannedSuccess")
    );
  }

  async function doAccountUnban() {
    await runAction(
      () => supabase.rpc("unban_account_user", { target_id: targetId }),
      t("moderation.accountUnbannedSuccess")
    );
  }

  async function doIpBan() {
    if (!lastSeenIp) return;
    if (!window.confirm(t("moderation.confirmIpBan", { ip: lastSeenIp }))) return;
    await runAction(
      () => supabase.rpc("ban_last_seen_ip", { target_id: targetId, reason: reason.trim() || null }),
      t("moderation.ipBannedSuccess")
    );
  }

  async function doIpUnban() {
    await runAction(
      () => supabase.rpc("unban_last_seen_ip", { target_id: targetId }),
      t("moderation.ipUnbannedSuccess")
    );
  }

  const actionButton =
    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50";
  const warningButton = `${actionButton} border-warning/40 text-warning hover:bg-warning/10`;
  const dangerButton = `${actionButton} border-danger/40 text-danger hover:bg-danger/10`;
  const successButton = `${actionButton} border-success/40 text-success hover:bg-success/10`;

  return (
    <div className="rounded-lg border border-ink-border bg-ink-surface2 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{targetEmoji ?? ":)"}</span>
        <span className="text-sm font-medium truncate flex-1">{targetName}</span>
        <PresenceDot userId={targetId} />
      </div>

      <div className="space-y-1">
        {isMuted && (
          <p className="text-xs text-warning font-mono">
            {t("chat.mutedMessage")} {mutedUntil && `- ${new Date(mutedUntil).toLocaleString()}`}
          </p>
        )}
        {muteReason && <p className="text-[11px] text-ink-muted">{t("chat.muteReason")}: {muteReason}</p>}
        {isChatBanned && <p className="text-xs text-danger font-mono">{t("moderation.chatBanned")}</p>}
        {chatBanReason && <p className="text-[11px] text-ink-muted">{t("chat.muteReason")}: {chatBanReason}</p>}
        {isAccountBanned && <p className="text-xs text-danger font-mono">{t("moderation.accountBanned")}</p>}
        {accountBanReason && <p className="text-[11px] text-ink-muted">{t("chat.muteReason")}: {accountBanReason}</p>}
        <p className="text-[10px] text-ink-faint font-mono">
          {t("moderation.lastSeenIp", { ip: lastSeenIp ?? t("moderation.noIp") })}
        </p>
        {isIpBanned && <p className="text-xs text-danger font-mono">{t("moderation.ipBanned")}</p>}
        {ipBanReason && <p className="text-[11px] text-ink-muted">{t("chat.muteReason")}: {ipBanReason}</p>}
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

      <div className="flex gap-2">
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          disabled={loading || isMuted}
          aria-label={t("chat.muteDurationLabel")}
          className="flex-1 rounded-md bg-ink-surface border border-ink-border px-2 py-1.5 text-xs outline-none focus:border-command disabled:opacity-50"
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={isMuted ? doUnmute : doMute}
          disabled={loading}
          className={isMuted ? successButton : warningButton}
        >
          {loading ? t("common.saving") : isMuted ? t("chat.unmuteUser") : t("chat.muteUser")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={isChatBanned ? doChatUnban : doChatBan}
          disabled={loading}
          className={isChatBanned ? successButton : dangerButton}
        >
          {isChatBanned ? t("moderation.unbanChat") : t("moderation.banChat")}
        </button>
        <button
          type="button"
          onClick={isAccountBanned ? doAccountUnban : doAccountBan}
          disabled={loading}
          className={isAccountBanned ? successButton : dangerButton}
        >
          {isAccountBanned ? t("moderation.unbanAccount") : t("moderation.banAccount")}
        </button>
        <button
          type="button"
          onClick={isIpBanned ? doIpUnban : doIpBan}
          disabled={loading || !lastSeenIp}
          className={isIpBanned ? successButton : dangerButton}
        >
          {isIpBanned ? t("moderation.unbanIp") : t("moderation.banIp")}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">{success}</p>}
      {blocked && <p className="text-[10px] text-ink-faint font-mono">{t("chat.mutedBlockedHint")}</p>}
    </div>
  );
}
