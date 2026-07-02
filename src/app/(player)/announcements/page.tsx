import { createClient } from "@/lib/supabase/server";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function PlayerAnnouncementsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, admin_id, title, content, created_at, admin:profiles(display_name, admin_role)")
    .order("created_at", { ascending: false });

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("announcements.playerKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("announcements.title")}</h1>
      </header>
      <AnnouncementsFeed initial={(announcements as any) ?? []} />
    </main>
  );
}
