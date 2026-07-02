import { createClient } from "@/lib/supabase/server";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, house:houses(name, slug, color, icon)")
    .eq("id", user!.id)
    .single();

  const { data: houses } = await supabase
    .from("house_points")
    .select("*")
    .order("total_points", { ascending: false });

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, created_at, admin:profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(3);

  const house = profile?.house ? (Array.isArray(profile.house) ? profile.house[0] : profile.house) : null;

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1">TỔNG QUAN</p>
        <h1 className="font-display font-bold text-3xl">
          Chào, {profile?.display_name?.split(" ").pop() ?? "bạn"} 👋
        </h1>
        {!house && (
          <p className="text-sm text-ink-muted mt-2 bg-ink-surface border border-ink-border rounded-lg px-4 py-2 inline-block">
            Bạn chưa được xếp vào house. Admin sẽ phân bổ sớm — hãy quay lại kiểm tra nhé.
          </p>
        )}
      </header>

      <section className="mb-10">
        <h2 className="font-display font-bold text-lg mb-4">Bảng xếp hạng House</h2>
        <HousePointsBoard initial={houses ?? []} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Thông báo mới nhất</h2>
          <Link href="/announcements" className="text-sm text-command hover:underline">
            Xem tất cả →
          </Link>
        </div>
        <div className="space-y-3">
          {(announcements ?? []).length === 0 && (
            <p className="text-sm text-ink-muted">Chưa có thông báo nào.</p>
          )}
          {(announcements ?? []).map((a: any) => (
            <div key={a.id} className="rounded-xl2 border border-ink-border bg-ink-surface p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-ink-faint font-mono">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: vi })}
                </p>
              </div>
              <p className="text-sm text-ink-muted line-clamp-2">{a.content}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
