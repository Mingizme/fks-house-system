import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectChatBox } from "@/components/DirectChatBox";
import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n-server";

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
    .select("id, display_name, avatar_emoji")
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
    .order("created_at", { ascending: true });

  const { data: blockRow } = await supabase
    .from("blocks")
    .select("id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", params.userId)
    .maybeSingle();

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/messages" className="text-ink-muted text-sm font-mono hover:text-ink-text">
        ← {t("messages.title")}
      </Link>
      <div className="mt-4">
        <DirectChatBox
          currentUserId={user.id}
          otherUser={otherUser}
          initialMessages={messages ?? []}
          isAdminChat={false}
          initiallyBlocked={!!blockRow}
        />
      </div>
    </main>
  );
}
