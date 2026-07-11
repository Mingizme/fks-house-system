"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { LeaderboardVisibility } from "@/lib/types";

interface Props {
  current: LeaderboardVisibility;
  canAdmin: boolean;
}

/**
 * Section quản lý phạm vi Bảng xếp hạng chung.
 */
export function LeaderboardVisibilitySection({ current, canAdmin }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function set(v: LeaderboardVisibility) {
    if (v === current || !canAdmin) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_leaderboard_visibility", { visibility: v });
    setBusy(false);
    if (error) alert(error.message);
    else router.refresh();
  }

  return (
    <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
      <div>
        <h2 className="font-display font-bold text-lg lg:text-xl">{t("permissions.leaderboardSection")}</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:gap-3">
        <button
          type="button"
          onClick={() => set("public")}
          disabled={!canAdmin || busy || current === "public"}
          className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
            current === "public"
              ? "bg-command/15 border-command text-command font-semibold"
              : "border-ink-border text-ink-muted hover:border-command/50"
          } disabled:opacity-50`}
        >
          🌐 {t("permissions.leaderboardPublic")}
        </button>
        <button
          type="button"
          onClick={() => set("masters_only")}
          disabled={!canAdmin || busy || current === "masters_only"}
          className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
            current === "masters_only"
              ? "bg-command/15 border-command text-command font-semibold"
              : "border-ink-border text-ink-muted hover:border-command/50"
          } disabled:opacity-50`}
        >
          👑 {t("permissions.leaderboardMastersOnly")}
        </button>
        <button
          type="button"
          onClick={() => set("admin_only")}
          disabled={!canAdmin || busy || current === "admin_only"}
          className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
            current === "admin_only"
              ? "bg-command/15 border-command text-command font-semibold"
              : "border-ink-border text-ink-muted hover:border-command/50"
          } disabled:opacity-50`}
        >
          🔒 {t("permissions.leaderboardAdminOnly")}
        </button>
      </div>
    </section>
  );
}
