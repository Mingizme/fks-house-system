"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import {
  DEPARTMENT_ADMIN_RANKS,
  departmentRoleTitle,
  type AdminRank,
  type Department,
  type DepartmentAdminRank,
} from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";

interface Props {
  adminRank: AdminRank | null;
  department: Department | null;
  departments: Department[];
  canManageAll: boolean;
}

const ROLE_LABEL_KEYS: Record<DepartmentAdminRank, TranslationKey> = {
  director: "permissions.rankDirector",
  deputy_director: "permissions.rankDeputyDirector",
  member: "permissions.rankMember",
};

function rowKey(departmentId: string, role: DepartmentAdminRank) {
  return `${departmentId}:${role}`;
}

function titleEditingEnabled(department: Department, role: DepartmentAdminRank): boolean {
  if (role === "director") return !!department.director_title_editing_enabled;
  if (role === "deputy_director") return !!department.deputy_director_title_editing_enabled;
  return !!department.member_title_editing_enabled;
}

function canToggleRoleTitle(
  actorRank: AdminRank | null,
  actorDepartmentId: string | null,
  targetDepartment: Department,
  targetRole: DepartmentAdminRank,
  canManageAll: boolean
) {
  if (canManageAll) return true;
  if (!actorDepartmentId || actorDepartmentId !== targetDepartment.id) return false;
  if (actorRank === "director") return targetRole === "deputy_director" || targetRole === "member";
  if (actorRank === "deputy_director") return targetRole === "member";
  return false;
}

function canEditRoleTitle(
  actorRank: AdminRank | null,
  actorDepartmentId: string | null,
  targetDepartment: Department,
  targetRole: DepartmentAdminRank,
  canManageAll: boolean
) {
  if (canManageAll) return true;
  if (!actorDepartmentId || actorDepartmentId !== targetDepartment.id) return false;
  return canToggleRoleTitle(actorRank, actorDepartmentId, targetDepartment, targetRole, false);
}

export function RoleTitleSettingsSection({ adminRank, department, departments, canManageAll }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const visibleDepartments = canManageAll ? departments : department ? [department] : [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toggleKey, setToggleKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hasAccess = visibleDepartments.some((dept) =>
    DEPARTMENT_ADMIN_RANKS.some(
      (role) =>
        canEditRoleTitle(adminRank, department?.id ?? null, dept, role, canManageAll) ||
        canToggleRoleTitle(adminRank, department?.id ?? null, dept, role, canManageAll)
    )
  );

  if (!hasAccess) return null;

  async function saveTitle(targetDepartment: Department, role: DepartmentAdminRank) {
    const key = rowKey(targetDepartment.id, role);
    const nextTitle = (drafts[key] ?? departmentRoleTitle(role, targetDepartment)).trim();
    if (!nextTitle) return;

    setSavingKey(key);
    setMsg(null);
    setErr(null);

    const { error } = await supabase.rpc("admin_rename_department_role_title", {
      dept_id: targetDepartment.id,
      role_rank: role,
      new_title: nextTitle,
    });

    setSavingKey(null);
    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(t("common.saved"));
    setTimeout(() => setMsg(null), 2000);
    router.refresh();
  }

  async function toggleEditing(targetDepartment: Department, role: DepartmentAdminRank) {
    const key = rowKey(targetDepartment.id, role);
    setToggleKey(key);
    setMsg(null);
    setErr(null);

    const { error } = await supabase.rpc("admin_set_department_role_title_editing", {
      dept_id: targetDepartment.id,
      role_rank: role,
      enabled: !titleEditingEnabled(targetDepartment, role),
    });

    setToggleKey(null);
    if (error) {
      setErr(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
      <div>
        <h2 className="font-display font-bold text-lg lg:text-xl">{t("permissions.roleTitleSection")}</h2>
        <p className="text-xs text-ink-muted mt-1">{t("permissions.roleTitleHint")}</p>
      </div>

      <div className="space-y-3">
        {visibleDepartments.map((dept) => (
          <div key={dept.id} className="rounded-lg border border-ink-border bg-ink-surface2 p-3 space-y-3 lg:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{dept.name}</p>
                <p className="text-[10px] text-ink-faint font-mono">key: {dept.key}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {DEPARTMENT_ADMIN_RANKS.map((role) => {
                const key = rowKey(dept.id, role);
                const currentTitle = departmentRoleTitle(role, dept);
                const draftTitle = drafts[key] ?? currentTitle;
                const canEdit = canEditRoleTitle(adminRank, department?.id ?? null, dept, role, canManageAll);
                const canToggle = canToggleRoleTitle(adminRank, department?.id ?? null, dept, role, canManageAll);
                const enabled = titleEditingEnabled(dept, role);
                const dirty = draftTitle.trim() !== currentTitle;

                if (!canEdit && !canToggle) return null;

                return (
                  <div key={role} className="rounded-md border border-ink-border bg-ink-surface p-3 space-y-2">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end">
                      <label className="min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-ink-muted uppercase">{t(ROLE_LABEL_KEYS[role])}</span>
                        <input
                          value={draftTitle}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [key]: e.target.value,
                            }))
                          }
                          disabled={!canEdit || savingKey === key}
                          maxLength={60}
                          className="w-full mt-1 rounded-md bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command disabled:opacity-50"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => saveTitle(dept, role)}
                            disabled={savingKey === key || !dirty || draftTitle.trim().length === 0}
                            className="rounded-md bg-command px-3 py-2 text-xs font-semibold transition-colors hover:bg-command/85 disabled:opacity-40"
                          >
                            {savingKey === key ? t("common.saving") : t("common.saveChanges")}
                          </button>
                        )}

                        {canToggle && (
                          <button
                            type="button"
                            onClick={() => toggleEditing(dept, role)}
                            disabled={toggleKey === key}
                            className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              enabled
                                ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
                                : "border-success/40 bg-success/10 text-success hover:bg-success/15"
                            }`}
                          >
                            {toggleKey === key
                              ? t("common.saving")
                              : enabled
                              ? t("permissions.lockRoleTitleEditing")
                              : t("permissions.unlockRoleTitleEditing")}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] font-mono text-ink-faint">
                      {enabled ? t("permissions.roleTitleEditingAllowed") : t("permissions.roleTitleEditingLocked")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {msg && <p className="text-xs text-success">{msg}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
    </section>
  );
}
