import { createClient } from "@/lib/supabase/server";
import { AdminGroupChat } from "@/components/AdminGroupChat";
import { MemberPopover } from "@/components/MemberPopover";
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

  const [{ data: messages }, { data: admins }] = await Promise.all([
    supabase
      .from("admin_messages")
      .select("id, sender_id, content, created_at, edited_at, deleted_at, reply_to_id, media_url, media_type, sender:profiles(display_name, avatar_emoji, avatar_url, user_type, admin_role)")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, admin_role")
      .eq("user_type", "admin")
      .order("display_name"),
  ]);

  return (
    <main className="p-8 max-w-6xl mx-auto animate-fadeRise">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("admin.groupChatKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("nav.adminGroupChat")}</h1>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminGroupChat
            currentUserId={user.id}
            initialMessages={(messages as any) ?? []}
          />
        </div>

        <div>
          <h2 className="font-display font-bold text-lg mb-3">
            Admin ({admins?.length ?? 0})
          </h2>
          <div className="rounded-xl2 border border-ink-border bg-ink-surface p-2 max-h-[400px] overflow-y-auto">
            {(admins ?? []).map((a) => (
              <MemberPopover
                key={a.id}
                memberId={a.id}
                displayName={`${a.display_name}${a.admin_role ? ` · ${a.admin_role}` : ""}`}
                avatarEmoji={a.avatar_emoji}
                messagesBasePath="/admin/messages"
                profileBasePath="/admin/profile"
                currentUserId={user.id}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
