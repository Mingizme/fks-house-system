import { createClient } from "@/lib/supabase/server";
import { AdminDirectoryClient } from "@/components/AdminDirectoryClient";
import { getServerTranslator } from "@/lib/i18n-server";

export const metadata = {
  title: "Admin Directory — FKS System",
  description: "Browse the admin team to find the right contact.",
};

export default async function AdminAdminDirectoryPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();

  const [{ data: departments }, { data: admins }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, key, name, director_title, member_title, sort_order, created_at")
      .order("sort_order"),
    supabase
      .from("profiles")
      .select(
        "id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, admin_rank, department_id, department:departments(id, key, name, director_title, member_title, sort_order, created_at), house_id, house_role, created_at"
      )
      .eq("user_type", "admin")
      .order("display_name"),
  ]);

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("adminDirectory.kicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("adminDirectory.title")}</h1>
        <p className="text-ink-muted text-sm mt-1">{t("adminDirectory.subtitle")}</p>
      </header>

      <AdminDirectoryClient
        initialDepartments={(departments as any) ?? []}
        initialAdmins={(admins as any) ?? []}
        messagesBasePath="/admin/messages"
        profileBasePath="/admin/profile"
      />
    </main>
  );
}
