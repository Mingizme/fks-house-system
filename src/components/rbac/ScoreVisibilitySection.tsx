"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { House, HouseMasterToggle, HouseScoreAudience } from "@/lib/types";

interface BlockRow {
  id?: string;
  master_id: string;
  master_display_name?: string;
  master_emoji?: string | null;
  blocked_by_name?: string | null;
}

interface Props {
  houses: House[];
  canAdminBlock: boolean;
  blockedMasters: BlockRow[];
}

const AUDIENCE_OPTIONS: HouseScoreAudience[] = ["house", "masters_only", "admin_only"];

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
              <th className="py-2 px-3">{t("permissions.scoreAudience")}</th>
              <th className="py-2 px-3">{t("permissions.masterCanToggle")}</th>
              <th className="py-2 pl-3" />
            </tr>
          </thead>
          <tbody>
            {houses.map((house) => (
              <HouseVisibilityRow
                key={house.id}
                house={house}
                canAdminBlock={canAdminBlock}
                supabase={supabase}
                router={router}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 border-t border-ink-border pt-4">
        <h3 className="text-sm font-semibold">{t("permissions.blockedMasters")}</h3>
        {blockedMasters.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("permissions.noBlockedMasters")}</p>
        ) : (
          <ul className="rounded-lg border border-ink-border divide-y divide-ink-border overflow-hidden lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-3 lg:border-0">
            {blockedMasters.map((block) => (
              <li key={block.master_id} className="p-3 flex items-center gap-3 bg-ink-surface2 lg:rounded-lg lg:border lg:border-ink-border">
                <span className="text-base">{block.master_emoji ?? "?"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{block.master_display_name ?? "-"}</p>
                  <p className="text-[10px] text-ink-faint font-mono">
                    {block.blocked_by_name ? t("common.by", { name: block.blocked_by_name }) : ""}
                  </p>
                </div>
                {canAdminBlock && <UnblockMasterButton masterId={block.master_id} supabase={supabase} router={router} />}
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
  const audience = getScoreAudience(house);
  const masterBlocked = (house.master_can_toggle_score ?? "allowed") === "blocked";
  const masterToggleApplies = audience === "masters_only";

  async function setAudience(next: HouseScoreAudience) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_house_score_audience", {
      house_uuid: house.id,
      audience: next,
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
      <td className="py-3 px-3 min-w-56">
        <select
          value={audience}
          onChange={(event) => void setAudience(event.target.value as HouseScoreAudience)}
          disabled={!canAdminBlock || busy}
          className="w-full rounded-md border border-ink-border bg-ink-surface2 px-2 py-1.5 text-xs text-ink-text outline-none transition-colors focus:border-command disabled:opacity-50"
        >
          {AUDIENCE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {audienceLabel(option, t)}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3 px-3">
        {masterToggleApplies ? (
          canAdminBlock ? (
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
              {masterBlocked ? t("permissions.masterToggleBlocked") : t("permissions.masterCanToggle")}
            </button>
          ) : (
            <span className={`text-xs ${masterBlocked ? "text-danger" : "text-success"}`}>
              {masterBlocked ? t("permissions.masterToggleBlocked") : t("permissions.masterCanToggle")}
            </span>
          )
        ) : (
          <span className="text-xs text-ink-faint">{t("permissions.masterToggleOnlyInMastersMode")}</span>
        )}
      </td>
      <td className="py-3 pl-3" />
    </tr>
  );
}

function getScoreAudience(house: House): HouseScoreAudience {
  if (house.score_audience) return house.score_audience;
  return (house.score_visibility ?? "visible") === "visible" ? "house" : "masters_only";
}

function audienceLabel(option: HouseScoreAudience, t: ReturnType<typeof useI18n>["t"]) {
  if (option === "house") return t("permissions.scoreAudienceHouse");
  if (option === "masters_only") return t("permissions.scoreAudienceMastersOnly");
  return t("permissions.scoreAudienceAdminOnly");
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
