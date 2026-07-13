import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectChatBox } from "@/components/DirectChatBox";
import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n-server";
import { getChatMarkdownSettingsForUser } from "@/lib/chat-markdown-settings";

export default async function AdminChatThreadPage({ params }: { params: { userId: string } }) {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (params.userId === user.id) redirect("/admin/chat");

  const [{ data: otherUser }, { data: messages }, { data: blockRow }, chatMarkdownSettings] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, user_type")
      .eq("id", params.userId)
      .single(),
    supabase
      .from("direct_messages")
      .select("*")
      .eq("is_admin_chat", true)
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${params.userId}),and(sender_id.eq.${params.userId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", params.userId)
      .maybeSingle(),
    getChatMarkdownSettingsForUser(supabase, user.id),
  ]);
  if (!otherUser || otherUser.user_type !== "admin") notFound();

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-6 lg:p-10">
      <Link href="/admin/chat" className="text-ink-muted text-sm font-mono hover:text-ink-text lg:text-base">{t("messages.backAllAdmin")}</Link>
      <div className="mt-4 min-h-[70svh] flex-1 lg:mt-6">
        <DirectChatBox
          currentUserId={user.id}
          otherUser={otherUser}
          initialMessages={((messages ?? []).slice().reverse() as any)}
          profileBasePath="/admin/profile"
          isAdminChat
          initiallyBlocked={!!blockRow}
          composerMarkdownSettings={chatMarkdownSettings}
        />
      </div>
    </main>
  );
}
