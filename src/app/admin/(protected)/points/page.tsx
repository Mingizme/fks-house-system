import { createClient } from "@/lib/supabase/server";
import { PointsLedger } from "@/components/PointsLedger";

export default async function AdminPointsPage() {
  const supabase = createClient();
  const { data: history } = await supabase
    .from("point_transactions")
    .select("id, house_id, admin_id, points, reason, created_at, admin:profiles(id, display_name, admin_role), house:houses(id, name, slug, color, icon)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">MINH BẠCH & KIỂM SOÁT</p>
        <h1 className="font-display font-bold text-3xl">Lịch sử cộng/trừ điểm</h1>
        <p className="text-ink-muted text-sm mt-1">Toàn bộ giao dịch điểm của mọi admin, hiển thị theo thời gian thực.</p>
      </header>
      <PointsLedger initial={(history as any) ?? []} />
    </main>
  );
}
