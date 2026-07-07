import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseAnnouncements } from "@/components/HouseAnnouncements";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "House Announcements — FKS System",
  description: "Announcements from your house leadership.",
};

export default async function HouseAnnouncementsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("house_id, house_role")
    .eq("id", user.id)
    .single();

  const canManage = profile?.house_role === "master" || profile?.house_role === "vice";

  const { data: announcements } = profile?.house_id
    ? await supabase
        .from("house_announcements")
        .select("id, house_id, author_id, title, content, created_at, author:profiles(display_name, avatar_emoji, house_role)")
        .eq("house_id", profile.house_id)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("houseAnn.kicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("houseAnn.title")}</h1>
      </header>

      {!profile?.house_id ? (
        <p className="text-sm text-ink-muted">{t("houseAnn.noHouse")}</p>
      ) : (
        <HouseAnnouncements
          houseId={profile.house_id}
          currentUserId={user.id}
          initial={(announcements as any) ?? []}
          canManage={canManage}
        />
      )}
    </main>
  );
}
