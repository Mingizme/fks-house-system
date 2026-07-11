import { createClient } from "@/lib/supabase/server";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard — FKS System",
  description: "Administrative dashboard for managing houses, players, and points.",
};

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
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-8 relative overflow-hidden rounded-xl2 glass-card p-6 lg:p-8">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-command/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-ink-muted font-mono text-xs mb-1 tracking-wider uppercase lg:text-sm">{t("admin.dashboardKicker")}</p>
          <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("admin.commandCenter")}</h1>
        </div>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 lg:gap-6 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl2 glass-card gradient-border p-5 lg:p-6 transition-transform duration-200 hover:-translate-y-0.5">
            <p className="text-xs text-ink-muted font-mono mb-1 tracking-wider">{s.label.toUpperCase()}</p>
            <p className={`font-mono text-3xl lg:text-4xl font-bold tabular-nums ${s.warn ? "text-danger" : "text-gradient"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {(unassignedCount ?? 0) > 0 && (
        <Link
          href="/admin/players"
          className="block mb-8 rounded-xl2 border border-command/40 bg-command/10 px-5 py-3 text-sm hover:bg-command/15 hover:shadow-glow transition-all duration-200 lg:px-6 lg:py-4 lg:text-base"
        >
          {t("admin.unassignedCta", { count: unassignedCount ?? 0 })}{" "}
          <span className="text-command font-semibold">{t("admin.assignNow")}</span>
        </Link>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-5 rounded-full bg-command-gradient" />
          {t("dashboard.leaderboard")}
        </h2>
        <HousePointsBoard initial={houses ?? []} linkPrefix="/admin/houses" />
      </section>
    </main>
  );
}
