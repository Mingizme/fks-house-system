import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerTranslator } from "@/lib/i18n-server";
import { DepartmentRenamingSection } from "@/components/rbac/DepartmentRenamingSection";
import { RoleTitleSettingsSection } from "@/components/rbac/RoleTitleSettingsSection";
import { ScoreVisibilitySection } from "@/components/rbac/ScoreVisibilitySection";
import { LeaderboardVisibilitySection } from "@/components/rbac/LeaderboardVisibilitySection";
import {
  isGlobalDirector,
  canEditOwnRoleTitle,
  canAdminBlockMasterScoreToggle,
  canSetLeaderboardVisibility,
} from "@/lib/permissions";
import type { ActorContext } from "@/lib/permissions";
import type { LeaderboardVisibility } from "@/lib/types";

interface BlockedMasterRow {
  id?: string;
  master_id: string;
  master_display_name?: string;
  master_emoji?: string | null;
  blocked_by_name?: string | null;
}

export const metadata = {
  title: "Permission Settings — FKS System",
  description: "Manage departments, role titles, score visibility, and the global leaderboard.",
};

export default async function PermissionSettingsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lấy profile đầy đủ để quyết định quyền UI
  const { data: me } = await supabase
    .from("profiles")
    .select("id, user_type, admin_rank, department_id")
    .eq("id", user.id)
    .single();

  if (!me || me.user_type !== "admin") redirect("/admin");

  const actor: ActorContext = {
    id: me.id,
    userType: me.user_type,
    adminRank: me.admin_rank,
    departmentId: me.department_id,
  };

  const canRename = isGlobalDirector(actor);
  const canEditRoleTitle = canEditOwnRoleTitle(actor);
  const canBlockMasterToggle = canAdminBlockMasterScoreToggle(actor);
  const canSetLeaderboard = canSetLeaderboardVisibility(actor);

  const [{ data: departments }, { data: houses }, { data: settings }, { data: blockedRows }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, key, name, director_title, member_title, sort_order, created_at")
      .order("sort_order"),
    supabase.from("houses").select("*").order("name"),
    supabase
      .from("system_settings")
      .select("id, leaderboard_visibility, role_title_editing_locked, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("house_master_score_blocks")
      .select(
        "id, master_id, master:profiles!house_master_score_blocks_master_id_fkey(display_name, avatar_emoji), blocked_by_admin:profiles!house_master_score_blocks_blocked_by_fkey(display_name)"
      ),
  ]);

  const blockedMasters: BlockedMasterRow[] = (blockedRows ?? []).map((r: any) => ({
    id: r.id,
    master_id: r.master_id,
    master_display_name: r.master?.display_name,
    master_emoji: r.master?.avatar_emoji,
    blocked_by_name: r.blocked_by_admin?.display_name,
  }));

  const currentVisibility: LeaderboardVisibility = (settings?.leaderboard_visibility as LeaderboardVisibility) ?? "public";
  const currentDepartment = departments?.find((department) => department.id === me.department_id) ?? null;
  const roleTitleEditingLocked = settings?.role_title_editing_locked ?? false;

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto space-y-8 animate-fadeRise">
      <header>
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("permissions.kicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("permissions.title")}</h1>
        <p className="text-ink-muted text-sm mt-1">{t("permissions.subtitle")}</p>
      </header>

      <DepartmentRenamingSection departments={(departments as any) ?? []} canRename={canRename} />

      <RoleTitleSettingsSection
        adminRank={me.admin_rank}
        department={(currentDepartment as any) ?? null}
        canEdit={canEditRoleTitle}
        canToggleLock={canRename}
        locked={roleTitleEditingLocked}
      />

      <ScoreVisibilitySection
        houses={(houses as any) ?? []}
        canAdminBlock={canBlockMasterToggle}
        blockedMasters={blockedMasters}
      />

      <LeaderboardVisibilitySection current={currentVisibility} canAdmin={canSetLeaderboard} />
    </main>
  );
}
