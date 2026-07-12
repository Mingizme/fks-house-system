import { createClient } from "@/lib/supabase/server";
import { AdminDirectoryClient } from "@/components/AdminDirectoryClient";
import { getServerTranslator } from "@/lib/i18n-server";
import { isGlobalDirector } from "@/lib/permissions";
import type { ActorContext } from "@/lib/permissions";
import type { AdminRank } from "@/lib/types";

export const metadata = {
  title: "Admin Directory — FKS System",
  description: "Browse the admin team to find the right contact.",
};

export default async function AdminAdminDirectoryPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // layout đã redirect, fallback
    return null;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("id, user_type, admin_rank, department_id")
    .eq("id", user.id)
    .single();

  const actor: ActorContext = {
    id: me?.id ?? "",
    userType: me?.user_type ?? "player",
    adminRank: (me?.admin_rank as AdminRank | null) ?? null,
    departmentId: me?.department_id ?? null,
  };
  const canSetRole = isGlobalDirector(actor);

  const [{ data: departments }, { data: admins }, { data: players }, { data: ipBans }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, key, name, director_title, deputy_director_title, member_title, director_title_editing_enabled, deputy_director_title_editing_enabled, member_title_editing_enabled, sort_order, created_at")
      .order("sort_order"),
    supabase
      .from("profiles")
      .select(
        "id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, admin_rank, department_id, role_title_override, department:departments(id, key, name, director_title, deputy_director_title, member_title, sort_order, created_at), house_id, house_role, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip, created_at"
      )
      .eq("user_type", "admin")
      .order("display_name"),
    // Nếu là Global Director, cũng load toàn bộ players để có thể phong admin ngay từ directory
    canSetRole
      ? supabase
          .from("profiles")
          .select(
            "id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, admin_rank, department_id, role_title_override, department:departments(id, key, name, director_title, deputy_director_title, member_title, sort_order, created_at), house_id, house_role, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip, created_at"
          )
          .eq("user_type", "player")
          .order("display_name")
      : Promise.resolve({ data: null } as any),
    supabase
      .from("ip_bans")
      .select("ip_address, reason, created_at")
      .is("lifted_at", null),
  ]);

  // Gộp admins + players cho Global Director (để có thể phong player lên admin trong cùng 1 directory)
  const combined = canSetRole
    ? [...(admins ?? []), ...(players ?? [])]
    : (admins ?? []);

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("adminDirectory.kicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("adminDirectory.title")}</h1>
        <p className="text-ink-muted text-sm mt-1">{t("adminDirectory.subtitle")}</p>
        {canSetRole && (
          <p className="text-xs text-command font-mono mt-2">
            ⚡ {t("permissions.youAreGlobalDirector")}
          </p>
        )}
      </header>

      <AdminDirectoryClient
        initialDepartments={(departments as any) ?? []}
        initialAdmins={(combined as any) ?? []}
        messagesBasePath="/admin/messages"
        profileBasePath="/admin/profile"
        canSetRole={canSetRole}
        currentUserId={user.id}
        viewerActor={actor}
        activeIpBans={(ipBans as any) ?? []}
      />
    </main>
  );
}
