"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { House } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";

export function AssignHouseSelect({
  playerId,
  currentHouseId,
  houses,
}: {
  playerId: string;
  currentHouseId: string | null;
  houses: House[];
}) {
  const supabase = createClient();
  const { t } = useI18n();
  const [value, setValue] = useState(currentHouseId ?? "");
  const [saving, setSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const houseId = e.target.value || null;
    const prevValue = value;
    setValue(e.target.value);
    setSaving(true);
    setHasError(false);
    const { error } = await supabase.from("profiles").update({ house_id: houseId }).eq("id", playerId);
    setSaving(false);
    if (error) {
      setValue(prevValue); // revert on failure
      setHasError(true);
      setTimeout(() => setHasError(false), 3000);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <select
        value={value}
        onChange={onChange}
        disabled={saving}
        aria-label={t("admin.houseUnassignedOption")}
        className={`rounded-lg bg-ink-surface2 border px-3 py-1.5 text-sm outline-none focus:border-command transition-colors disabled:opacity-50 ${
          hasError ? "border-danger" : "border-ink-border"
        }`}
      >
        <option value="">{t("admin.houseUnassignedOption")}</option>
        {houses.map((h) => (
          <option key={h.id} value={h.id}>
            {h.icon} {h.name}
          </option>
        ))}
      </select>
      {hasError && <span className="text-xs text-danger">✕</span>}
    </div>
  );
}
