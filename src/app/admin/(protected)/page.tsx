import { createClient } from "@/lib/supabase/server";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function AdminDashboardPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();

  const [{ data: houses }, { count: unassignedCount }, { count: playerCount }, { count: adminCount }] =
    await Promise.all([
      supabase.from("house_points").select("*").order("total_points", { ascending: false }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "player").is("house_id", null),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "player"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "admin"),
    ]);

  const stats = [
    { label: t("admin.totalPlayers"), value: playerCount ?? 0 },
    { label: t("admin.unassignedHouse"), value: unassignedCount ?? 0, warn: (unassignedCount ?? 0) > 0 },
    { label: t("admin.activeAdmins"), value: adminCount ?? 0 },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("admin.dashboardKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("admin.commandCenter")}</h1>
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
          {t("admin.unassignedCta", { count: unassignedCount ?? 0 })}{" "}
          <span className="text-command font-semibold">{t("admin.assignNow")}</span>
        </Link>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-4">{t("dashboard.leaderboard")}</h2>
        <HousePointsBoard initial={houses ?? []} linkPrefix="/admin/houses" />
      </section>
    </main>
  );
}
