"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { AdminRank, Department } from "@/lib/types";

interface Props {
  targetId: string;
  targetName: string;
  targetEmoji: string | null;
  departments: Department[];
  currentDeptKey?: string | null;
  currentRank?: AdminRank | null;
  isPlayer?: boolean;
  /** True nếu người đang xem là Global Director */
  canSetRole: boolean;
}

const RANKS: Array<{
  value: Exclude<AdminRank, "global_director">;
  labelKey: "permissions.rankDirector" | "permissions.rankMember";
}> = [
  { value: "director", labelKey: "permissions.rankDirector" },
  { value: "member", labelKey: "permissions.rankMember" },
];

/**
 * Control cho Global Director: đổi department + rank của bất kỳ admin/player nào.
 * - Với player: phong lên làm admin (chọn department + rank).
 * - Với admin: đổi department / thăng/giáng rank. Để rank=member và dept=Executive thì contextual.
 *
 * Lưu ý: chỉ Global Director mới thấy control này (canSetRole = true).
 */
export function AdminSetRoleControl({
  targetId,
  targetName,
  targetEmoji,
  departments,
  currentDeptKey,
  currentRank,
  isPlayer,
  canSetRole,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [deptKey, setDeptKey] = useState<string>(currentDeptKey ?? "admin");
  const [rank, setRank] = useState<Exclude<AdminRank, "global_director">>(
    currentRank === "director" || currentRank === "member" ? currentRank : "member"
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!canSetRole) return null;

  async function apply() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    const { error: rpcError } = await supabase.rpc("admin_set_role", {
      target_id: targetId,
      dept_key: deptKey,
      new_rank: rank,
    });
    setSaving(false);
    if (rpcError) {
      setErr(rpcError.message);
    } else {
      setMsg(t("common.saved"));
      setTimeout(() => setMsg(null), 2500);
      router.refresh();
    }
  }

  async function demoteToPlayer() {
    if (!confirm(t("permissions.confirmDemote", { name: targetName }))) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    const { error: rpcError } = await supabase.rpc("admin_demote_to_player", {
      target_id: targetId,
    });
    setSaving(false);
    if (rpcError) {
      setErr(rpcError.message);
    } else {
      setMsg(t("common.saved"));
      setTimeout(() => setMsg(null), 2500);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-ink-border bg-ink-surface2 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{targetEmoji ?? "🙂"}</span>
        <span className="text-sm font-medium truncate flex-1">{targetName}</span>
        {isPlayer && (
          <span className="text-[10px] font-mono text-success bg-success/10 border border-success/30 rounded px-1.5 py-0.5">
            {t("permissions.playerBadge")}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <label className="flex-1">
          <span className="text-[10px] font-mono text-ink-muted uppercase block mb-1">{t("permissions.department")}</span>
          <select
            value={deptKey}
            onChange={(e) => setDeptKey(e.target.value)}
            disabled={saving}
            className="w-full rounded-md bg-ink-surface border border-ink-border px-2 py-1.5 text-xs outline-none focus:border-command"
          >
            {departments.slice().sort((a, b) => a.sort_order - b.sort_order).map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="text-[10px] font-mono text-ink-muted uppercase block mb-1">{t("permissions.role")}</span>
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value as Exclude<AdminRank, "global_director">)}
            disabled={saving}
            className="w-full rounded-md bg-ink-surface border border-ink-border px-2 py-1.5 text-xs outline-none focus:border-command"
          >
            {RANKS.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={apply}
          disabled={saving}
          className="flex-1 rounded-md bg-command hover:bg-command/85 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          {saving ? t("common.saving") : `🏠 ${isPlayer ? t("permissions.promoteToAdmin") : t("permissions.applyRole")}`}
        </button>
        {!isPlayer && (
          <button
            type="button"
            onClick={demoteToPlayer}
            disabled={saving}
            className="rounded-md border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {`↓ ${t("permissions.playerBadge")}`}
          </button>
        )}
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}
      {msg && <p className="text-xs text-success">{msg}</p>}
    </div>
  );
}
