import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectChatBox } from "@/components/DirectChatBox";
import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n-server";
import { getChatMarkdownSettingsForUser } from "@/lib/chat-markdown-settings";

export default async function AdminMessageThreadPage({ params }: { params: { userId: string } }) {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (params.userId === user.id) redirect("/admin/messages");

  const { data: otherUser } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_emoji, avatar_url")
    .eq("id", params.userId)
    .single();
  if (!otherUser) notFound();

  const { data: messages } = await supabase
    .from("direct_messages")
    .select("*")
    .eq("is_admin_chat", false)
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${params.userId}),and(sender_id.eq.${params.userId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: blockRow } = await supabase
    .from("blocks")
    .select("id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", params.userId)
    .maybeSingle();
  const chatMarkdownSettings = await getChatMarkdownSettingsForUser(supabase, user.id);

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-ink-surface">
      <div className="flex-1 min-h-0">
        <DirectChatBox
          currentUserId={user.id}
          otherUser={otherUser}
          initialMessages={((messages ?? []).slice().reverse() as any)}
          profileBasePath="/admin/profile"
          isAdminChat={false}
          initiallyBlocked={!!blockRow}
          composerMarkdownSettings={chatMarkdownSettings}
        />
      </div>
    </main>
  );
}
