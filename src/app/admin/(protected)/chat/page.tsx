import { createClient } from "@/lib/supabase/server";
import { AdminGroupChat } from "@/components/AdminGroupChat";
import { AdminChatSidePanel } from "@/components/AdminChatSidePanel";
import { getServerTranslator } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

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

  const [{ data: messages }, { data: admins }, { data: departments }] = await Promise.all([
    supabase
      .from("admin_messages")
      .select("id, sender_id, content, created_at, edited_at, deleted_at, reply_to_id, media_url, media_type, sender:profiles(display_name, avatar_emoji, avatar_url, user_type, admin_role)")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, admin_rank, department_id, username, department:departments(id, name, director_title, member_title, sort_order)")
      .eq("user_type", "admin")
      .order("display_name"),
    supabase
      .from("departments")
      .select("id, key, name, director_title, member_title, sort_order, created_at")
      .order("sort_order"),
  ]);

  return (
    <main className="p-8 max-w-6xl mx-auto animate-fadeRise">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("admin.groupChatKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("nav.adminGroupChat")}</h1>
      </header>

      <div className="flex gap-4 h-[calc(100vh-210px)] min-h-[620px]">
        <div className="flex-1 min-w-0">
          <AdminGroupChat
            currentUserId={user.id}
            initialMessages={(messages as any) ?? []}
          />
        </div>

        <div className="hidden lg:block w-72 shrink-0">
          <AdminChatSidePanel
            admins={(admins as any) ?? []}
            departments={(departments as any) ?? []}
            messagesBasePath="/admin/messages"
            profileBasePath="/admin/profile"
            currentUserId={user.id}
          />
        </div>
      </div>
    </main>
  );
}
