"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { House } from "@/lib/types";

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
  const [value, setValue] = useState(currentHouseId ?? "");
  const [saving, setSaving] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const houseId = e.target.value || null;
    setValue(e.target.value);
    setSaving(true);
    await supabase.from("profiles").update({ house_id: houseId }).eq("id", playerId);
    setSaving(false);
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={saving}
      className="rounded-lg bg-ink-surface2 border border-ink-border px-3 py-1.5 text-sm outline-none focus:border-command transition-colors disabled:opacity-50"
    >
      <option value="">— Chưa xếp house —</option>
      {houses.map((h) => (
        <option key={h.id} value={h.id}>
          {h.icon} {h.name}
        </option>
      ))}
    </select>
  );
}
