"use client";

import { useEffect, useState } from "react";
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
  const [visibility, setVisibility] = useState<LeaderboardVisibility>(current);

  useEffect(() => {
    setVisibility(current);
  }, [current]);

  async function setGlobalVisibility(v: LeaderboardVisibility) {
    if (v === visibility || !canAdmin || busy) return;

    const previous = visibility;
    setVisibility(v);
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_leaderboard_visibility", { visibility: v });
    setBusy(false);
    if (error) {
      setVisibility(previous);
      alert(error.message);
    } else {
      router.refresh();
    }
  }

  return (
    <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
      <div>
        <h2 className="font-display font-bold text-lg lg:text-xl">{t("permissions.leaderboardSection")}</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:gap-3">
        <button
          type="button"
          onClick={() => setGlobalVisibility("public")}
          disabled={!canAdmin || busy || visibility === "public"}
          className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
            visibility === "public"
              ? "bg-command/15 border-command text-command font-semibold"
              : "border-ink-border text-ink-muted hover:border-command/50"
          } disabled:opacity-50`}
        >
          🌐 {t("permissions.leaderboardPublic")}
        </button>
        <button
          type="button"
          onClick={() => setGlobalVisibility("masters_only")}
          disabled={!canAdmin || busy || visibility === "masters_only"}
          className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
            visibility === "masters_only"
              ? "bg-command/15 border-command text-command font-semibold"
              : "border-ink-border text-ink-muted hover:border-command/50"
          } disabled:opacity-50`}
        >
          👑 {t("permissions.leaderboardMastersOnly")}
        </button>
        <button
          type="button"
          onClick={() => setGlobalVisibility("admin_only")}
          disabled={!canAdmin || busy || visibility === "admin_only"}
          className={`flex-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
            visibility === "admin_only"
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
