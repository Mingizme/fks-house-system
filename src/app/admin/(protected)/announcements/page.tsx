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
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("announcements.adminKicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("announcements.title")}</h1>
      </header>
      <div className="xl:grid xl:gap-8 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.65fr)] 2xl:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.8fr)]">
        <NewAnnouncementForm adminId={user!.id} />
        <AnnouncementsFeed initial={(announcements as any) ?? []} />
      </div>
    </main>
  );
}
