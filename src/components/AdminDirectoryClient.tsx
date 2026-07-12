"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import { usePresence } from "@/components/PresenceProvider";
import { PresenceDot } from "@/components/PresenceDot";
import { AdminSetRoleControl } from "@/components/rbac/AdminSetRoleControl";
import { AdminMuteControl } from "@/components/AdminMuteControl";
import { canMute } from "@/lib/permissions";
import { departmentTitle } from "@/lib/types";
import type { ActorContext } from "@/lib/permissions";
import type { AdminDirectoryEntry, Department, DepartmentAdminRank } from "@/lib/types";

const DEPARTMENT_SELECT_COLUMNS =
  "id, key, name, director_title, deputy_director_title, member_title, director_title_editing_enabled, deputy_director_title_editing_enabled, member_title_editing_enabled, sort_order, created_at";

function isDepartmentAdminRank(rank: AdminDirectoryEntry["admin_rank"]): rank is DepartmentAdminRank {
  return rank === "director" || rank === "deputy_director" || rank === "member";
}

function titleEditingEnabled(department: Department, rank: DepartmentAdminRank): boolean {
  if (rank === "director") return !!department.director_title_editing_enabled;
  if (rank === "deputy_director") return !!department.deputy_director_title_editing_enabled;
  return !!department.member_title_editing_enabled;
}

function canEditProfileRoleTitle(
  actor: ActorContext | null,
  target: AdminDirectoryEntry,
  targetDepartment: Department | null
): boolean {
  if (!actor || actor.userType !== "admin" || target.user_type !== "admin") return false;
  if (actor.adminRank === "global_director") return true;
  if (!isDepartmentAdminRank(target.admin_rank) || !targetDepartment || !actor.departmentId) return false;
  if (actor.departmentId !== (target.department_id ?? targetDepartment.id)) return false;

  if (actor.id === target.id && actor.adminRank === target.admin_rank) {
    return titleEditingEnabled(targetDepartment, target.admin_rank);
  }

  if (actor.adminRank === "director") {
    return target.admin_rank === "deputy_director" || target.admin_rank === "member";
  }

  if (actor.adminRank === "deputy_director") {
    return target.admin_rank === "member";
  }

  return false;
}

interface Props {
  initialDepartments: Department[];
  initialAdmins: AdminDirectoryEntry[];
  /** Base path cho profile & message (vd "/messages" đối với player) */
  messagesBasePath: string;
  profileBasePath: string;
  isPlayer?: boolean;
  /** Viewer có quyền đổi role không (Global Director) */
  canSetRole?: boolean;
  currentUserId?: string;
  viewerActor?: ActorContext | null;
  activeIpBans?: Array<{ ip_address: string; reason: string | null; created_at: string }>;
}

function AdminRoleTitleOverrideControl({
  targetId,
  currentTitle,
  defaultTitle,
  canEdit,
  onSaved,
}: {
  targetId: string;
  currentTitle?: string | null;
  defaultTitle: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { t } = useI18n();
  const [title, setTitle] = useState(currentTitle ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(currentTitle ?? "");
  }, [currentTitle]);

  if (!canEdit) return null;

  const dirty = title.trim() !== (currentTitle ?? "").trim();

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);

    const { error } = await supabase.rpc("admin_set_profile_role_title", {
      target_id: targetId,
      new_title: title.trim() || null,
    });

    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(t("common.saved"));
    setTimeout(() => setMsg(null), 2000);
    onSaved();
  }

  return (
    <div className="rounded-lg border border-ink-border bg-ink-surface2 p-3 space-y-2">
      <label className="block">
        <span className="text-[10px] font-mono text-ink-muted uppercase">{t("permissions.roleTitleCurrent")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          maxLength={60}
          placeholder={defaultTitle}
          className="w-full mt-1 rounded-md bg-ink-surface border border-ink-border px-3 py-2 text-sm outline-none focus:border-command disabled:opacity-50"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-ink-faint">{t("permissions.profileRoleTitleHint")}</p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-md bg-command px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-command/85 disabled:opacity-40"
        >
          {saving ? t("common.saving") : t("common.saveChanges")}
        </button>
      </div>
      {msg && <p className="text-xs text-success">{msg}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}

/**
 * Danh sách các admin theo từng department.
 * - Player xem, bấm vào admin để xem profile + chat riêng
 * - Có thể filter theo department
 */
export function AdminDirectoryClient({
  initialDepartments,
  initialAdmins,
  messagesBasePath,
  profileBasePath,
  isPlayer: _isPlayer,
  canSetRole = false,
  currentUserId,
  viewerActor = null,
  activeIpBans = [],
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const { isOnline } = usePresence();
  const [admins, setAdmins] = useState<AdminDirectoryEntry[]>(initialAdmins);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [activeDept, setActiveDept] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<AdminDirectoryEntry | null>(null);

  useEffect(() => {
    setAdmins(initialAdmins);
    setSelectedAdmin((current) => {
      if (!current) return null;
      return initialAdmins.find((row) => row.id === current.id) ?? current;
    });
  }, [initialAdmins]);

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  async function refetchDepartments() {
    const { data } = await supabase
      .from("departments")
      .select(DEPARTMENT_SELECT_COLUMNS)
      .order("sort_order");

    if (data) setDepartments(data as unknown as Department[]);
  }

  async function refetchDirectory() {
    const baseSelectColumns =
      "id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, admin_rank, department_id, role_title_override, department:departments(id, key, name, director_title, deputy_director_title, member_title, sort_order, created_at), house_id, house_role, created_at";
    const moderationSelectColumns =
      "id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, admin_rank, department_id, role_title_override, department:departments(id, key, name, director_title, deputy_director_title, member_title, sort_order, created_at), house_id, house_role, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip, created_at";
    const selectColumns = viewerActor ? moderationSelectColumns : baseSelectColumns;

    const [{ data: adminRows }, { data: playerRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select(selectColumns)
        .eq("user_type", "admin")
        .order("display_name"),
      canSetRole
        ? supabase
            .from("profiles")
            .select(selectColumns)
            .eq("user_type", "player")
            .order("display_name")
        : Promise.resolve({ data: null } as any),
    ]);

    const nextRows = canSetRole
      ? [...(adminRows ?? []), ...(playerRows ?? [])]
      : adminRows ?? [];

    setAdmins(nextRows as unknown as AdminDirectoryEntry[]);
    setSelectedAdmin((current) => {
      if (!current) return null;
      return (nextRows as any[]).find((row) => row.id === current.id) ?? current;
    });
  }

  // Realtime: cập nhật admin profiles (đổi department/rank/role)
  useEffect(() => {
    const channel = supabase
      .channel("admin-directory-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void refetchDirectory()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "departments" },
        () => {
          void refetchDepartments();
          void refetchDirectory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, canSetRole, viewerActor]);

  const filtered = admins.filter((a) => {
    if (activeDept !== "all") {
      const deptKey =
        a.department?.key ??
        departments.find((department) => department.id === a.department_id)?.key;
      if (deptKey !== activeDept) return false;
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        a.display_name.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group theo department
  const byDept = new Map<string, AdminDirectoryEntry[]>();
  for (const a of filtered) {
    const key = a.department?.key ?? "unassigned";
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key)!.push(a);
  }

  const deptOrder = departments.slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,0.85fr)] xl:grid-cols-[minmax(0,2.4fr)_minmax(380px,0.9fr)] xl:gap-8">
      <div className="space-y-4 lg:space-y-5">
        {/* Filter & search */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("messages.searchAdmin")}
            className="flex-1 min-w-[200px] rounded-lg bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command lg:px-4 lg:py-3 lg:text-base"
          />
          <select
            value={activeDept}
            onChange={(e) => setActiveDept(e.target.value)}
            className="rounded-lg bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command lg:px-4 lg:py-3 lg:text-base"
          >
            <option value="all">{t("adminDirectory.department")}</option>
            {deptOrder.map((d) => (
              <option key={d.id} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* List theo department */}
        {deptOrder.map((dept) => {
          const list = byDept.get(dept.key) ?? [];
          if (list.length === 0) return null;
          return (
            <section
              key={dept.id}
              className="rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-ink-border flex items-center justify-between lg:px-5 lg:py-4">
                <div>
                  <p className="font-display font-bold">{dept.name}</p>
                  <p className="text-[11px] text-ink-muted font-mono">
                    {dept.director_title} / {dept.deputy_director_title} / {dept.member_title}
                  </p>
                </div>
                <span className="text-xs text-ink-faint font-mono">{list.length}</span>
              </div>
              <ul className="divide-y divide-ink-border">
                {list.map((a) => {
                  const online = isOnline(a.id);
                  const displayDept =
                    departments.find((d) => d.id === (a.department?.id ?? a.department_id) || d.key === a.department?.key) ??
                    a.department ??
                    dept;
                  const roleTitle = departmentTitle(a.admin_rank, displayDept, a.role_title_override);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAdmin(a)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-ink-surface2 transition-colors text-left lg:px-5 lg:py-4 lg:gap-4"
                      >
                        <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden shrink-0 lg:h-11 lg:w-11 lg:text-xl">
                          {a.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            a.avatar_emoji ?? "🙂"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate lg:text-base">{a.display_name}</p>
                          <p className="text-xs text-ink-faint font-mono truncate">@{a.username}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-success font-mono">{roleTitle}</p>
                          <p className="text-[10px] text-ink-faint">
                            {online ? t("adminDirectory.onlineNow") : t("adminDirectory.offlineNow")}
                          </p>
                        </div>
                        <PresenceDot userId={a.id} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {/* Section Players (chỉ Global Director thấy): những user_type=player, không có department */}
        {canSetRole && (() => {
          const playersList = byDept.get("unassigned") ?? [];
          if (playersList.length === 0) return null;
          return (
            <section className="rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-border flex items-center justify-between lg:px-5 lg:py-4">
                <div>
                  <p className="font-display font-bold">{t("permissions.playersSection")}</p>
                  <p className="text-[11px] text-ink-muted font-mono">
                    {t("permissions.playersSectionHint")}
                  </p>
                </div>
                <span className="text-xs text-ink-faint font-mono">{playersList.length}</span>
              </div>
              <ul className="divide-y divide-ink-border">
                {playersList.map((a) => {
                  const online = isOnline(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAdmin(a)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-ink-surface2 transition-colors text-left lg:px-5 lg:py-4 lg:gap-4"
                      >
                        <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden shrink-0 lg:h-11 lg:w-11 lg:text-xl">
                          {a.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            a.avatar_emoji ?? "🙂"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate lg:text-base">{a.display_name}</p>
                          <p className="text-xs text-ink-faint font-mono truncate">@{a.username}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-success bg-success/10 border border-success/30 rounded px-1.5 py-0.5">
                            {t("permissions.playerBadge")}
                          </span>
                          <p className="text-[10px] text-ink-faint mt-1">
                            {online ? t("adminDirectory.onlineNow") : t("adminDirectory.offlineNow")}
                          </p>
                        </div>
                        <PresenceDot userId={a.id} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })()}

        {filtered.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-8">{t("adminDirectory.empty")}</p>
        )}
      </div>

      {/* Detail panel */}
      <aside className="lg:sticky lg:top-8 self-start">
        {selectedAdmin ? (
          <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-ink-surface2 flex items-center justify-center text-2xl overflow-hidden lg:h-16 lg:w-16">
                {selectedAdmin.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedAdmin.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  selectedAdmin.avatar_emoji ?? "🙂"
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedAdmin.display_name}</p>
                <p className="text-xs text-ink-faint font-mono truncate">@{selectedAdmin.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <PresenceDot userId={selectedAdmin.id} />
                  <span className="text-[11px] text-ink-muted">
                    {isOnline(selectedAdmin.id)
                      ? t("adminDirectory.onlineNow")
                      : t("adminDirectory.offlineNow")}
                  </span>
                </div>
              </div>
            </div>

            {selectedAdmin.bio && (
              <p className="text-sm text-ink-muted border-l-2 border-ink-border pl-3">
                {selectedAdmin.bio}
              </p>
            )}

            <div className="flex gap-2">
              <Link
                href={`${profileBasePath}/${selectedAdmin.id}`}
                className="flex-1 rounded-lg border border-ink-border hover:border-command/50 px-3 py-2 text-sm text-center transition-colors"
              >
                {t("adminDirectory.viewProfile")}
              </Link>
              <Link
                href={`${messagesBasePath}/${selectedAdmin.id}`}
                className="flex-1 rounded-lg bg-command hover:bg-command/85 text-ink-text font-semibold px-3 py-2 text-sm text-center transition-colors"
              >
                {t("adminDirectory.messageAdmin")}
              </Link>
            </div>

            {(() => {
              const selectedDepartment =
                departments.find(
                  (department) =>
                    department.id === (selectedAdmin.department?.id ?? selectedAdmin.department_id) ||
                    department.key === selectedAdmin.department?.key
                ) ??
                selectedAdmin.department ??
                null;
              const defaultRoleTitle = departmentTitle(selectedAdmin.admin_rank, selectedDepartment);
              const canEditRoleTitle = canEditProfileRoleTitle(viewerActor, selectedAdmin, selectedDepartment);

              return (
                <AdminRoleTitleOverrideControl
                  targetId={selectedAdmin.id}
                  currentTitle={selectedAdmin.role_title_override}
                  defaultTitle={defaultRoleTitle}
                  canEdit={canEditRoleTitle}
                  onSaved={() => void refetchDirectory()}
                />
              );
            })()}

            {(() => {
              const activeIpBan = selectedAdmin.last_seen_ip
                ? activeIpBans.find((ban) => ban.ip_address === selectedAdmin.last_seen_ip)
                : null;
              const canModerate =
                !!viewerActor &&
                canMute(viewerActor, {
                  id: selectedAdmin.id,
                  userType: selectedAdmin.user_type,
                  adminRank: selectedAdmin.admin_rank,
                  departmentId: selectedAdmin.department_id,
                });

              return canModerate ? (
                <AdminMuteControl
                  targetId={selectedAdmin.id}
                  targetName={selectedAdmin.display_name}
                  targetEmoji={selectedAdmin.avatar_emoji}
                  blocked={null}
                  mutedUntil={selectedAdmin.muted_until}
                  muteReason={selectedAdmin.mute_reason}
                  chatBannedAt={selectedAdmin.chat_banned_at}
                  chatBanReason={selectedAdmin.chat_ban_reason}
                  accountBannedAt={selectedAdmin.account_banned_at}
                  accountBanReason={selectedAdmin.account_ban_reason}
                  lastSeenIp={selectedAdmin.last_seen_ip}
                  ipBannedAt={activeIpBan?.created_at ?? null}
                  ipBanReason={activeIpBan?.reason ?? null}
                  canMute={true}
                />
              ) : null;
            })()}

            {canSetRole && selectedAdmin.id !== currentUserId && (
              <AdminSetRoleControl
                targetId={selectedAdmin.id}
                targetName={selectedAdmin.display_name}
                targetEmoji={selectedAdmin.avatar_emoji}
                departments={departments}
                currentDeptKey={selectedAdmin.department?.key ?? "admin"}
                currentRank={selectedAdmin.admin_rank}
                isPlayer={selectedAdmin.user_type === "player"}
                canSetRole={canSetRole}
              />
            )}
          </div>
        ) : (
          <div className="rounded-xl2 border border-dashed border-ink-border bg-ink-surface p-5 text-sm text-ink-muted lg:p-6">
            {t("adminDirectory.subtitle")}
          </div>
        )}
      </aside>
    </div>
  );
}
