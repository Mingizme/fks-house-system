"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { HouseScoreVisibility } from "@/lib/types";

interface Props {
  houseId: string;
  initialVisibility: HouseScoreVisibility;
}

export function HouseScoreVisibilityToggle({ houseId, initialVisibility }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState<HouseScoreVisibility>(initialVisibility);
  const scoreVisibleToHouse = visibility === "visible";

  async function toggleVisibility() {
    const next: HouseScoreVisibility = scoreVisibleToHouse ? "hidden" : "visible";
    setBusy(true);
    const { error } = await supabase.rpc("set_house_score_visibility", {
      house_uuid: houseId,
      visibility: next,
    });
    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    setVisibility(next);
    router.refresh();
  }

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t("house.masterScoreControl")}</p>
        <p className="text-xs text-ink-muted">
          {scoreVisibleToHouse ? t("house.masterScoreVisibleHint") : t("house.masterScoreHiddenHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={busy}
        className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
          scoreVisibleToHouse
            ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
            : "border-success/40 bg-success/10 text-success hover:bg-success/15"
        }`}
      >
        {scoreVisibleToHouse ? t("house.hideScoreFromHouse") : t("house.showScoreToHouse")}
      </button>
    </div>
  );
}
