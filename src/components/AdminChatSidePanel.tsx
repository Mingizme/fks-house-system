"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/components/PresenceProvider";
import { MemberPopover } from "@/components/MemberPopover";
import { useI18n } from "@/components/I18nProvider";
import { departmentTitle } from "@/lib/types";
import type { AdminRank, Department } from "@/lib/types";

export interface AdminChatMember {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  admin_rank: AdminRank | null;
  department_id: string | null;
  role_title_override?: string | null;
  department?: Pick<Department, "id" | "name" | "director_title" | "deputy_director_title" | "member_title" | "sort_order"> | null;
  username?: string;
}

interface Props {
  admins: AdminChatMember[];
  departments: Department[];
  messagesBasePath: string;
  profileBasePath: string;
  currentUserId: string;
}

const ADMIN_SELECT =
  "id, display_name, avatar_emoji, avatar_url, admin_rank, department_id, role_title_override, username, department:departments(id, name, director_title, deputy_director_title, member_title, sort_order)";

/** rank ordering trong 1 department: director -> deputy -> member */
function rankOrder(rank: AdminRank | null) {
  if (rank === "director") return 0;
  if (rank === "deputy_director") return 1;
  if (rank === "member") return 2;
  return 3;
}

interface DeptGroup {
  key: string;
  title: string;
  members: AdminChatMember[];
}

/**
 * Nhóm admin cho panel chat admin:
 *  - Global Director đứng đầu (section riêng)
 *  - Sau đó từng department theo sort_order; trong department: Director -> Deputy -> Member
 */
function buildGroups(admins: AdminChatMember[], departments: Department[]): DeptGroup[] {
  const groups: DeptGroup[] = [];

  const globals = admins
    .filter((a) => a.admin_rank === "global_director")
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  if (globals.length > 0) {
    groups.push({ key: "global", title: "Global Director", members: globals });
  }

  const deptOrder = [...departments].sort((a, b) => a.sort_order - b.sort_order);
  for (const dept of deptOrder) {
    const members = admins
      .filter((a) => a.admin_rank !== "global_director" && (a.department?.id ?? a.department_id) === dept.id)
      .sort((a, b) => {
        const ra = rankOrder(a.admin_rank);
        const rb = rankOrder(b.admin_rank);
        if (ra !== rb) return ra - rb;
        return a.display_name.localeCompare(b.display_name);
      });
    if (members.length > 0) {
      groups.push({ key: dept.id, title: dept.name, members });
    }
  }

  return groups;
}

export function AdminChatSidePanel({
  admins,
  departments,
  messagesBasePath,
  profileBasePath,
  currentUserId,
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const { isOnline } = usePresence();
  const [liveAdmins, setLiveAdmins] = useState<AdminChatMember[]>(admins);

  useEffect(() => {
    setLiveAdmins(admins);
  }, [admins]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-chat-roster")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: "user_type=eq.admin" },
        () => {
          supabase
            .from("profiles")
            .select(ADMIN_SELECT)
            .eq("user_type", "admin")
            .order("display_name")
            .then(({ data }) => {
              if (data) setLiveAdmins(data as unknown as AdminChatMember[]);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const groups = useMemo(() => buildGroups(liveAdmins, departments), [liveAdmins, departments]);
  const onlineCount = useMemo(() => liveAdmins.filter((a) => isOnline(a.id)).length, [liveAdmins, isOnline]);

  return (
    <aside className="flex flex-col rounded-xl2 glass-card overflow-hidden h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink-border/60">
        <p className="text-xs font-mono text-ink-muted uppercase tracking-wide">
          {t("house.membersWithCount", { count: liveAdmins.length })}
        </p>
        <span className="flex items-center gap-1 text-[10px] font-mono text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
          {onlineCount} {t("presence.online")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0 space-y-3">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="px-2 pb-1 text-[10px] font-mono text-ink-faint uppercase tracking-wider">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.members.map((m) => {
                const label = departmentTitle(m.admin_rank, m.department ?? null, m.role_title_override);
                return (
                  <div key={m.id} className="relative">
                    <MemberPopover
                      memberId={m.id}
                      displayName={m.display_name}
                      avatarEmoji={m.avatar_emoji}
                      roleLabel={label || null}
                      messagesBasePath={messagesBasePath}
                      profileBasePath={profileBasePath}
                      currentUserId={currentUserId}
                      presenceDot
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-ink-muted p-3">{t("adminDirectory.empty")}</p>
        )}
      </div>
    </aside>
  );
}
