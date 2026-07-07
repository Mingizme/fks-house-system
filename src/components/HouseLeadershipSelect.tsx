"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { HouseRole } from "@/lib/types";

interface Member {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  house_role: HouseRole | null;
}

export function HouseLeadershipSelect({ roster }: { roster: Member[] }) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();

  const currentMaster = roster.find((m) => m.house_role === "master")?.id ?? "";
  const currentVice = roster.find((m) => m.house_role === "vice")?.id ?? "";

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface p-4 space-y-4">
      <h2 className="font-display font-bold text-lg">{t("admin.leadershipTitle")}</h2>
      <LeaderRow
        key={`master-${currentMaster}`}
        label={t("admin.masterLabel")}
        role="master"
        roster={roster}
        currentId={currentMaster}
        supabase={supabase}
        router={router}
        noneLabel={t("admin.leaderNone")}
      />
      <LeaderRow
        key={`vice-${currentVice}`}
        label={t("admin.viceLabel")}
        role="vice"
        roster={roster}
        currentId={currentVice}
        supabase={supabase}
        router={router}
        noneLabel={t("admin.leaderNone")}
      />
    </div>
  );
}

function LeaderRow({
  label,
  role,
  roster,
  currentId,
  supabase,
  router,
  noneLabel,
}: {
  label: string;
  role: HouseRole;
  roster: Member[];
  currentId: string;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
  noneLabel: string;
}) {
  const [value, setValue] = useState(currentId);
  const [saving, setSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value;
    const prev = value;
    setValue(nextId);
    setSaving(true);
    setHasError(false);

    let error;
    if (!nextId) {
      // Clear whoever currently holds this role
      if (prev) ({ error } = await supabase.rpc("clear_house_leader", { target_id: prev }));
    } else {
      ({ error } = await supabase.rpc("set_house_leader", { target_id: nextId, new_role: role }));
    }

    setSaving(false);
    if (error) {
      setValue(prev);
      setHasError(true);
      setTimeout(() => setHasError(false), 3000);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-28 shrink-0">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={saving}
        aria-label={label}
        className={`flex-1 rounded-lg bg-ink-surface2 border px-3 py-1.5 text-sm outline-none focus:border-command transition-colors disabled:opacity-50 ${
          hasError ? "border-danger" : "border-ink-border"
        }`}
      >
        <option value="">{noneLabel}</option>
        {roster.map((m) => (
          <option key={m.id} value={m.id}>
            {m.avatar_emoji ?? "🙂"} {m.display_name}
          </option>
        ))}
      </select>
      {hasError && <span className="text-xs text-danger">✕</span>}
    </div>
  );
}
