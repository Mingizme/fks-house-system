"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";
import { usePresence } from "@/components/PresenceProvider";
import { PresenceDot } from "@/components/PresenceDot";
import { AdminSetRoleControl } from "@/components/rbac/AdminSetRoleControl";
import type { AdminDirectoryEntry, Department } from "@/lib/types";

interface Props {
  initialDepartments: Department[];
  initialAdmins: AdminDirectoryEntry[];
  /** Base path cho profile & message (vd "/messages" đối với player) */
  messagesBasePath: string;
  profileBasePath: string;
  isPlayer?: boolean;
  /** Viewer có quyền đổi role không (Global Director) */
  canSetRole?: boolean;
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
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const { isOnline } = usePresence();
  const [admins, setAdmins] = useState<AdminDirectoryEntry[]>(initialAdmins);
  const [departments] = useState<Department[]>(initialDepartments);
  const [activeDept, setActiveDept] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<AdminDirectoryEntry | null>(null);

  // Realtime: cập nhật admin profiles (đổi department/rank/role)
  useEffect(() => {
    const channel = supabase
      .channel("admin-directory-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: "user_type=eq.admin" },
        () => {
          supabase
            .from("profiles")
            .select(
              "id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, admin_rank, department_id, department:departments(id, key, name, director_title, member_title, sort_order, created_at), house_id, house_role, created_at"
            )
            .eq("user_type", "admin")
            .order("display_name")
            .then(({ data }) => {
              if (data) setAdmins((data as unknown as AdminDirectoryEntry[]) ?? []);
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "departments" },
        () => {
          // departments được reload qua router.refresh (server)
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filtered = admins.filter((a) => {
    if (activeDept !== "all") {
      const deptId = a.department?.id ?? a.department_id;
      const deptKey = a.department?.key;
      const wanted = departments.find((d) => d.id === deptId || d.key === activeDept);
      if (deptKey !== activeDept && wanted?.key !== deptKey) return false;
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
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {/* Filter & search */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("messages.searchAdmin")}
            className="flex-1 min-w-[200px] rounded-lg bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command"
          />
          <select
            value={activeDept}
            onChange={(e) => setActiveDept(e.target.value)}
            className="rounded-lg bg-ink-surface2 border border-ink-border px-3 py-2 text-sm outline-none focus:border-command"
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
              <div className="px-4 py-3 border-b border-ink-border flex items-center justify-between">
                <div>
                  <p className="font-display font-bold">{dept.name}</p>
                  <p className="text-[11px] text-ink-muted font-mono">
                    {dept.director_title} · {dept.member_title}
                  </p>
                </div>
                <span className="text-xs text-ink-faint font-mono">{list.length}</span>
              </div>
              <ul className="divide-y divide-ink-border">
                {list.map((a) => {
                  const online = isOnline(a.id);
                  const roleTitle =
                    a.admin_rank === "global_director"
                      ? "Global Director"
                      : a.admin_rank === "director"
                      ? dept.director_title
                      : dept.member_title;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAdmin(a)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-ink-surface2 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden shrink-0">
                          {a.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            a.avatar_emoji ?? "🙂"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.display_name}</p>
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
              <div className="px-4 py-3 border-b border-ink-border flex items-center justify-between">
                <div>
                  <p className="font-display font-bold">Players</p>
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
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-ink-surface2 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden shrink-0">
                          {a.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            a.avatar_emoji ?? "🙂"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.display_name}</p>
                          <p className="text-xs text-ink-faint font-mono truncate">@{a.username}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-success bg-success/10 border border-success/30 rounded px-1.5 py-0.5">
                            PLAYER
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
      <aside className="lg:sticky lg:top-6 self-start">
        {selectedAdmin ? (
          <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-ink-surface2 flex items-center justify-center text-2xl overflow-hidden">
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

            {canSetRole && (
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
          <div className="rounded-xl2 border border-dashed border-ink-border bg-ink-surface p-5 text-sm text-ink-muted">
            {t("adminDirectory.subtitle")}
          </div>
        )}
      </aside>
    </div>
  );
}
