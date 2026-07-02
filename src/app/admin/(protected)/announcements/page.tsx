import { createClient } from "@/lib/supabase/server";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { NewAnnouncementForm } from "@/components/NewAnnouncementForm";

export default async function AdminAnnouncementsPage() {
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
        <p className="text-ink-muted font-mono text-xs mb-1">TỪ BAN QUẢN TRỊ ĐẾN TOÀN THỂ PLAYER</p>
        <h1 className="font-display font-bold text-3xl">Thông báo</h1>
      </header>
      <NewAnnouncementForm adminId={user!.id} />
      <AnnouncementsFeed initial={(announcements as any) ?? []} />
    </main>
  );
}
