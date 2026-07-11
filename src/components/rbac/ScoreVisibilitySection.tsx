"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { House, HouseMasterToggle } from "@/lib/types";

interface BlockRow {
  id?: string;
  master_id: string;
  master_display_name?: string;
  master_emoji?: string | null;
  blocked_by_name?: string | null;
}

interface Props {
  houses: House[];
  /** Admin được phép đổi (true) */
  canAdminBlock: boolean;
  blockedMasters: BlockRow[];
}

/**
 * Section quản lý hiển thị điểm house:
 *  - Bật/tắt score_visibility cho từng house (chỉ House Master khi chưa bị cấm)
 *  - Admin cấm/cho phép House Master toggle
 *  - Admin cấm đích danh House Master xem điểm
 */
export function ScoreVisibilitySection({ houses, canAdminBlock, blockedMasters }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
      <div>
        <h2 className="font-display font-bold text-lg lg:text-xl">{t("permissions.scoreVisibilitySection")}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm lg:text-base">
          <thead>
            <tr className="text-left text-[10px] font-mono text-ink-muted uppercase">
              <th className="py-2 pr-3">{t("permissions.scoreVisibilityHouse")}</th>
              <th className="py-2 px-3">{t("permissions.scoreVisible")}</th>
              <th className="py-2 px-3">{t("permissions.masterCanToggle")}</th>
              <th className="py-2 pl-3" />
            </tr>
          </thead>
          <tbody>
            {houses.map((h) => (
              <HouseVisibilityRow key={h.id} house={h} canAdminBlock={canAdminBlock} supabase={supabase} router={router} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Master blocks */}
      <div className="space-y-2 border-t border-ink-border pt-4">
        <h3 className="text-sm font-semibold">{t("permissions.blockedMasters")}</h3>
        {blockedMasters.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("permissions.noBlockedMasters")}</p>
        ) : (
          <ul className="rounded-lg border border-ink-border divide-y divide-ink-border overflow-hidden lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-3 lg:border-0">
            {blockedMasters.map((b) => (
              <li key={b.master_id} className="p-3 flex items-center gap-3 bg-ink-surface2 lg:rounded-lg lg:border lg:border-ink-border">
                <span className="text-base">{b.master_emoji ?? "🙂"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{b.master_display_name ?? "—"}</p>
                  <p className="text-[10px] text-ink-faint font-mono">
                    {b.blocked_by_name ? t("common.by", { name: b.blocked_by_name }) : ""}
                  </p>
                </div>
                {canAdminBlock && <UnblockMasterButton masterId={b.master_id} supabase={supabase} router={router} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface HouseRowProps {
  house: House;
  canAdminBlock: boolean;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
}

function HouseVisibilityRow({ house, canAdminBlock, supabase, router }: HouseRowProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const scoreVisible = (house.score_visibility ?? "visible") === "visible";
  const masterBlocked = (house.master_can_toggle_score ?? "allowed") === "blocked";

  async function toggleScore() {
    setBusy(true);
    const { error } = await supabase.rpc("set_house_score_visibility", {
      house_uuid: house.id,
      visibility: scoreVisible ? "hidden" : "visible",
    });
    setBusy(false);
    if (error) {
      alert(error.message);
    } else {
      router.refresh();
    }
  }

  async function toggleMasterBlock() {
    setBusy(true);
    const next: HouseMasterToggle = masterBlocked ? "allowed" : "blocked";
    const { error } = await supabase.rpc("admin_set_master_score_toggle", {
      house_uuid: house.id,
      toggle: next,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
    } else {
      router.refresh();
    }
  }

  return (
    <tr className="border-t border-ink-border">
      <td className="py-3 pr-3">
        <span className="font-medium">{house.icon} {house.name}</span>
      </td>
      <td className="py-3 px-3">
        <button
          type="button"
          onClick={toggleScore}
          disabled={busy}
          title={scoreVisible ? t("permissions.scoreVisible") : t("permissions.scoreHidden")}
          className={`text-xs px-2 py-1 rounded-md border transition-colors ${
            scoreVisible
              ? "bg-success/10 border-success/40 text-success"
              : "bg-ink-surface2 border-ink-border text-ink-muted"
          } disabled:opacity-50`}
        >
          {scoreVisible ? "👁 " + t("permissions.scoreVisible") : "🔒 " + t("permissions.scoreHidden")}
        </button>
      </td>
      <td className="py-3 px-3">
        {canAdminBlock ? (
          <button
            type="button"
            onClick={toggleMasterBlock}
            disabled={busy}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              masterBlocked
                ? "bg-danger/10 border-danger/40 text-danger"
                : "bg-success/10 border-success/40 text-success"
            } disabled:opacity-50`}
          >
            {masterBlocked ? "⛔ " + t("permissions.masterToggleBlocked") : "✓ " + t("permissions.masterCanToggle")}
          </button>
        ) : (
          <span className={`text-xs ${masterBlocked ? "text-danger" : "text-success"}`}>
            {masterBlocked ? "⛔" : "✓"}
          </span>
        )}
      </td>
      <td className="py-3 pl-3" />
    </tr>
  );
}

function UnblockMasterButton({
  masterId,
  supabase,
  router,
}: {
  masterId: string;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function unblock() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_unblock_master_score", { master_uuid: masterId });
    setBusy(false);
    if (error) alert(error.message);
    else router.refresh();
  }

  return (
    <button
      type="button"
      onClick={unblock}
      disabled={busy}
      className="text-xs rounded-md border border-success/40 text-success hover:bg-success/10 px-2 py-1 transition-colors disabled:opacity-50"
    >
      {t("permissions.unblockMasterScoreView")}
    </button>
  );
}
