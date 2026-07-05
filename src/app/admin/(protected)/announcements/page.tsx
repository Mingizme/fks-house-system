import { createClient } from "@/lib/supabase/server";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { NewAnnouncementForm } from "@/components/NewAnnouncementForm";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Announcements Management — FKS System",
  description: "Create and manage official system-wide announcements.",
};

export default async function AdminAnnouncementsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, admin_id, title, content, created_at, admin:profiles(display_name, admin_role)")
    .order("created_at", { ascending: false });

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("announcements.adminKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("announcements.title")}</h1>
      </header>
      <NewAnnouncementForm adminId={user!.id} />
      <AnnouncementsFeed initial={(announcements as any) ?? []} />
    </main>
  );
}
