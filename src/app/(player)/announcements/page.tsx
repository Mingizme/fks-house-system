import { createClient } from "@/lib/supabase/server";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Announcements — FKS System",
  description: "View important announcements from the administration team.",
};

export default async function PlayerAnnouncementsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, admin_id, title, content, created_at, admin:profiles(display_name, admin_role)")
    .order("created_at", { ascending: false });

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("announcements.playerKicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("announcements.title")}</h1>
      </header>
      <AnnouncementsFeed initial={(announcements as any) ?? []} />
    </main>
  );
}
