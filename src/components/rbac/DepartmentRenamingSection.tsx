"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import type { Department } from "@/lib/types";

interface Props {
  departments: Department[];
  /** Admin có quyền đổi tên department không (chỉ Global Director) */
  canRename: boolean;
}

/**
 * Phần quản lý tên Departments.
 * Role titles được chỉnh riêng trong RoleTitleSettingsSection.
 */
export function DepartmentRenamingSection({ departments, canRename }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
      <div>
        <h2 className="font-display font-bold text-lg lg:text-xl">{t("permissions.departmentsSection")}</h2>
        <p className="text-xs text-ink-muted mt-1">{t("permissions.legend")}</p>
      </div>

      {!canRename && (
        <p className="text-xs text-ink-faint font-mono italic">{t("permissions.globalDirectorOnly")}</p>
      )}

      <div className="space-y-3">
        {departments.map((d) => (
          <DepartmentRow key={d.id} department={d} canRename={canRename} supabase={supabase} router={router} />
        ))}
      </div>
    </section>
  );
}

function DepartmentRow({
  department,
  canRename,
  supabase,
  router,
}: {
  department: Department;
  canRename: boolean;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(department.name);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dirty = name.trim() !== department.name;

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    const { error: rpcError } = await supabase.rpc("rename_department_name", {
      dept_id: department.id,
      new_name: name.trim(),
    });
    setSaving(false);
    if (rpcError) {
      setErr(rpcError.message);
    } else {
      setMsg(t("common.saved"));
      setTimeout(() => setMsg(null), 2000);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-ink-border bg-ink-surface2 p-3 space-y-2 lg:p-4">
      <div className="grid grid-cols-1 gap-2 lg:gap-3">
        <label className="block">
          <span className="text-[10px] font-mono text-ink-muted uppercase">{t("permissions.deptName")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canRename || saving}
            className="w-full mt-1 rounded-md bg-ink-surface border border-ink-border px-2 py-1.5 text-sm outline-none focus:border-command disabled:opacity-50"
          />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-faint font-mono">key: {department.key}</span>
        <button
          type="button"
          onClick={save}
          disabled={!canRename || saving || !dirty}
          className="rounded-md bg-command hover:bg-command/85 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          {saving ? t("common.saving") : t("permissions.rename")}
        </button>
      </div>
      {msg && <p className="text-xs text-success">{msg}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
