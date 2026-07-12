import { createClient } from "@/lib/supabase/server";
import { AdminChatWorkspace } from "@/components/AdminChatWorkspace";
import { getServerTranslator } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getChatMarkdownSettingsForUser } from "@/lib/chat-markdown-settings";

export const metadata: Metadata = {
  title: "Admin Group Chat — FKS System",
  description: "Private group chat for all administrators.",
};

export default async function AdminChatPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: messages }, { data: admins }, { data: departments }, chatMarkdownSettings] = await Promise.all([
    supabase
      .from("admin_messages")
      .select("*, sender:profiles(display_name, avatar_emoji, avatar_url, user_type, admin_role)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, admin_rank, department_id, role_title_override, username, department:departments(id, name, director_title, deputy_director_title, member_title, sort_order)")
      .eq("user_type", "admin")
      .order("display_name"),
    supabase
      .from("departments")
      .select("id, key, name, director_title, deputy_director_title, member_title, director_title_editing_enabled, deputy_director_title_editing_enabled, member_title_editing_enabled, sort_order, created_at")
      .order("sort_order"),
    getChatMarkdownSettingsForUser(supabase, user.id),
  ]);

  return (
    <main className="w-full p-6 lg:p-8 animate-fadeRise">
      <div className="hidden lg:block mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("admin.groupChatKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("nav.adminGroupChat")}</h1>
      </div>

      <AdminChatWorkspace
        currentUserId={user.id}
        initialMessages={(((messages as any[]) ?? []).slice().reverse() as any)}
        admins={(admins as any) ?? []}
        departments={(departments as any) ?? []}
          composerMarkdownSettings={chatMarkdownSettings}
      />
    </main>
  );
}
