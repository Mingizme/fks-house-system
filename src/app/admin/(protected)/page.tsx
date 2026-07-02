import { createClient } from "@/lib/supabase/server";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const [{ data: houses }, { count: unassignedCount }, { count: playerCount }, { count: adminCount }] =
    await Promise.all([
      supabase.from("house_points").select("*").order("total_points", { ascending: false }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "player").is("house_id", null),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "player"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "admin"),
    ]);

  const stats = [
    { label: "Tổng player", value: playerCount ?? 0 },
    { label: "Chưa xếp house", value: unassignedCount ?? 0, warn: (unassignedCount ?? 0) > 0 },
    { label: "Admin đang hoạt động", value: adminCount ?? 0 },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1">TỔNG QUAN HỆ THỐNG</p>
        <h1 className="font-display font-bold text-3xl">Trung tâm chỉ huy</h1>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl2 border border-ink-border bg-ink-surface p-5">
            <p className="text-xs text-ink-muted font-mono mb-1">{s.label.toUpperCase()}</p>
            <p className={`font-mono text-3xl font-bold ${s.warn ? "text-danger" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {(unassignedCount ?? 0) > 0 && (
        <Link
          href="/admin/players"
          className="block mb-8 rounded-xl2 border border-command/40 bg-command/10 px-5 py-3 text-sm hover:bg-command/15 transition-colors"
        >
          ⚡ {unassignedCount} player mới chưa được xếp vào house — <span className="text-command font-semibold">phân bổ ngay →</span>
        </Link>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-4">Bảng xếp hạng House</h2>
        <HousePointsBoard initial={houses ?? []} linkPrefix="/admin/houses" />
      </section>
    </main>
  );
}
