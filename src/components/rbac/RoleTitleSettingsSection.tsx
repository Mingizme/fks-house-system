"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import { departmentTitle, type AdminRank, type Department } from "@/lib/types";

interface Props {
  adminRank: AdminRank | null;
  department: Department | null;
  canEdit: boolean;
  canToggleLock: boolean;
  locked: boolean;
}

export function RoleTitleSettingsSection({
  adminRank,
  department,
  canEdit,
  canToggleLock,
  locked,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const currentTitle = departmentTitle(adminRank, department);
  const [title, setTitle] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!canEdit && !canToggleLock) return null;

  const dirty = title.trim() !== currentTitle;
  const canSave = canEdit && !!department && !locked && dirty && title.trim().length > 0;

  async function saveTitle() {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    setErr(null);

    const { error } = await supabase.rpc("admin_rename_own_role_title", {
      new_title: title.trim(),
    });

    setSaving(false);
    if (error) {
      setErr(error.message);
    } else {
      setMsg(t("common.saved"));
      setTimeout(() => setMsg(null), 2000);
      router.refresh();
    }
  }

  async function toggleLock() {
    if (!canToggleLock) return;
    setLockSaving(true);
    setMsg(null);
    setErr(null);

    const { error } = await supabase.rpc("admin_set_role_title_editing_locked", {
      locked: !locked,
    });

    setLockSaving(false);
    if (error) {
      setErr(error.message);
    } else {
      router.refresh();
    }
  }

  return (
    <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display font-bold text-lg lg:text-xl">{t("permissions.roleTitleSection")}</h2>
          <p className="text-xs text-ink-muted mt-1">{t("permissions.roleTitleHint")}</p>
        </div>

        {canToggleLock && (
          <button
            type="button"
            onClick={toggleLock}
            disabled={lockSaving}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              locked
                ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
                : "border-success/40 bg-success/10 text-success hover:bg-success/15"
            }`}
          >
            {lockSaving
              ? t("common.saving")
              : locked
              ? t("permissions.unlockRoleTitleEditing")
              : t("permissions.lockRoleTitleEditing")}
          </button>
        )}
      </div>

      {locked && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {t("permissions.roleTitleEditingLocked")}
        </p>
      )}

      {canEdit ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className="text-[10px] font-mono text-ink-muted uppercase">{t("permissions.roleTitleCurrent")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!department || locked || saving}
              maxLength={60}
              className="w-full mt-1 rounded-md bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command disabled:opacity-50 lg:text-base"
            />
          </label>
          <button
            type="button"
            onClick={saveTitle}
            disabled={saving || !canSave}
            className="rounded-md bg-command px-4 py-2 text-sm font-semibold transition-colors hover:bg-command/85 disabled:opacity-40"
          >
            {saving ? t("common.saving") : t("common.saveChanges")}
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-faint font-mono italic">{t("permissions.roleTitleDirectorOnly")}</p>
      )}

      {msg && <p className="text-xs text-success">{msg}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
    </section>
  );
}
