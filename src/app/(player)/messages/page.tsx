import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { getServerTranslator } from "@/lib/i18n-server";
import { PlayerList } from "@/components/PlayerList";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages — FKS System",
  description: "Chat with players from other houses or administrative staff.",
};

export default async function MessagesListPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch recent conversations
  const { data: dms } = await supabase
    .from("direct_messages")
    .select("sender_id, recipient_id, content, created_at")
    .eq("is_admin_chat", false)
    .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  const lastByUser = new Map<string, { content: string; created_at: string }>();
  (dms ?? []).forEach((m) => {
    const otherId = m.sender_id === user!.id ? m.recipient_id : m.sender_id;
    if (!lastByUser.has(otherId)) lastByUser.set(otherId, { content: m.content, created_at: m.created_at });
  });

  const otherIds = [...lastByUser.keys()];
  const { data: convProfiles } =
    otherIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_emoji").in("id", otherIds)
      : { data: [] };

  const conversations = (convProfiles ?? [])
    .map((p) => ({ ...p, last: lastByUser.get(p.id)! }))
    .sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());

  // Fetch all players + houses for the "All Players" section
  const [{ data: allProfiles }, { data: houses }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, house_id")
      .order("display_name"),
    supabase.from("houses").select("id, name, icon").order("name"),
  ]);

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("messages.kicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("messages.title")}</h1>
      </header>

      {/* Recent conversations */}
      {conversations.length > 0 && (
        <div className="mb-8 space-y-1">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="flex items-center gap-3 p-3 rounded-xl2 hover:bg-ink-surface border border-transparent hover:border-ink-border transition-colors"
            >
              <span className="w-10 h-10 rounded-full bg-ink-surface2 flex items-center justify-center text-lg shrink-0">
                {c.avatar_emoji ?? "🙂"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{c.display_name}</p>
                <p className="text-sm text-ink-muted truncate">{c.last.content}</p>
              </div>
              <span className="text-xs text-ink-faint font-mono shrink-0">
                {format(new Date(c.last.created_at), "HH:mm")}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* All Players section */}
      <section>
        <h2 className="font-display font-bold text-lg mb-3">{t("messages.allPlayers")}</h2>
        <PlayerList
          players={(allProfiles ?? []) as any}
          houses={(houses ?? []) as any}
          basePath="/messages"
          currentUserId={user!.id}
        />
      </section>
    </main>
  );
}
