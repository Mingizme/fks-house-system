"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

export function AddPointsForm({ houseId, adminId }: { houseId: string; adminId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [points, setPoints] = useState<number>(10);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(sign: 1 | -1) {
    setError(null);
    setOk(false);
    if (!reason.trim()) {
      setError(t("points.reasonRequired"));
      return;
    }
    if (!points || points <= 0) {
      setError(t("points.positiveRequired"));
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("point_transactions").insert({
      house_id: houseId,
      admin_id: adminId,
      points: points * sign,
      reason: reason.trim(),
    });
    setSaving(false);
    if (insertError) {
      setError(t("points.saveFailed"));
      return;
    }
    setReason("");
    setOk(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5">
      <p className="font-display font-bold mb-4">{t("points.formTitle")}</p>
      <div className="flex gap-3 mb-3">
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          aria-label={t("points.formTitle")}
          className="w-24 rounded-lg bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("points.reasonPlaceholder")}
          aria-label={t("points.reasonPlaceholder")}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command"
        />
      </div>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {ok && <p className="text-sm text-success mb-3">{t("points.saved")}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => submit(1)}
          disabled={saving}
          className="flex-1 rounded-lg bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors font-semibold py-2 text-sm disabled:opacity-50"
        >
          {t("points.add")}
        </button>
        <button
          onClick={() => submit(-1)}
          disabled={saving}
          className="flex-1 rounded-lg bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors font-semibold py-2 text-sm disabled:opacity-50"
        >
          {t("points.subtract")}
        </button>
      </div>
    </div>
  );
}
