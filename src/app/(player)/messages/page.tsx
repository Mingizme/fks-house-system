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
    .order("created_at", { ascending: false })
    .limit(500);

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
      .order("display_name")
      .limit(1000),
    supabase.from("houses").select("id, name, icon").order("name"),
  ]);

  return (
    <main className="w-full max-w-[1800px] mx-auto p-6 lg:p-8 xl:p-10">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("messages.kicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("messages.title")}</h1>
      </header>

      <div
        className={
          conversations.length > 0
            ? "grid min-w-0 gap-8 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)] 2xl:grid-cols-[minmax(360px,0.7fr)_minmax(0,2fr)]"
            : "min-w-0"
        }
      >
        {/* Recent conversations */}
        {conversations.length > 0 && (
          <section className="min-w-0">
            <h2 className="font-display font-bold text-lg mb-3 lg:mb-5 lg:text-2xl">{t("messages.recent")}</h2>
            <div className="space-y-1 lg:max-h-[calc(100vh-220px)] lg:space-y-3 lg:overflow-y-auto lg:pr-2">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/messages/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl2 hover:bg-ink-surface border border-transparent hover:border-ink-border transition-colors lg:gap-4 lg:p-4"
                >
                  <span className="w-10 h-10 rounded-full bg-ink-surface2 flex items-center justify-center text-lg shrink-0 lg:h-14 lg:w-14 lg:text-2xl">
                    {c.avatar_emoji ?? "🙂"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate lg:text-lg">{c.display_name}</p>
                    <p className="text-sm text-ink-muted truncate lg:text-base">{c.last.content}</p>
                  </div>
                  <span className="text-xs text-ink-faint font-mono shrink-0 lg:text-sm">
                    {format(new Date(c.last.created_at), "HH:mm")}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All Players section */}
        <section className="min-w-0">
          <h2 className="font-display font-bold text-lg mb-3 lg:mb-5 lg:text-2xl">{t("messages.allPlayers")}</h2>
          <PlayerList
            players={(allProfiles ?? []) as any}
            houses={(houses ?? []) as any}
            basePath="/messages"
            currentUserId={user!.id}
          />
        </section>
      </div>
    </main>
  );
}
