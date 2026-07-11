import { createClient } from "@/lib/supabase/server";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — FKS System",
  description: "View point boards, leaderboard standings, and latest announcements.",
};

export default async function DashboardPage() {
  const { t, dateLocale } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, house_id, house_role, house:houses(name, slug, color, icon)")
    .eq("id", user!.id)
    .single();

  const { data: canViewLeaderboardData, error: canViewLeaderboardError } = await supabase.rpc("can_view_leaderboard");
  const canViewLeaderboard = canViewLeaderboardError ? true : canViewLeaderboardData !== false;

  const [{ data: houses }, { data: canViewOwnHouseScore, error: ownHouseScoreError }] = await Promise.all([
    canViewLeaderboard
      ? supabase
          .from("house_points")
          .select("*")
          .order("total_points", { ascending: false })
      : Promise.resolve({ data: [] } as any),
    canViewLeaderboard && profile?.house_id
      ? supabase.rpc("can_view_house_score", { house_uuid: profile.house_id, viewer_id: user!.id })
      : Promise.resolve({ data: true } as any),
  ]);

  const hiddenHouseIds =
    !ownHouseScoreError && canViewOwnHouseScore === false && profile?.house_id ? [profile.house_id] : [];

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, created_at, admin:profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(3);

  const house = profile?.house ? (Array.isArray(profile.house) ? profile.house[0] : profile.house) : null;

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-8 relative overflow-hidden rounded-xl2 glass-card p-6 lg:p-8">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-command/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-ink-muted font-mono text-xs mb-1 tracking-wider uppercase lg:text-sm">{t("dashboard.kicker")}</p>
          <h1 className="font-display font-bold text-3xl lg:text-4xl">
            {t("dashboard.greeting", { name: profile?.display_name?.split(" ").pop() ?? t("common.you") })}
          </h1>
          {!house && (
            <p className="text-sm text-ink-muted mt-3 bg-ink-surface2/70 border border-ink-border rounded-lg px-4 py-2 inline-block">
              {t("dashboard.notAssigned")}
            </p>
          )}
        </div>
      </header>

      <section className="mb-10">
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-5 rounded-full bg-command-gradient" />
          {t("dashboard.leaderboard")}
        </h2>
        {canViewLeaderboard ? (
          <HousePointsBoard initial={houses ?? []} hiddenHouseIds={hiddenHouseIds} />
        ) : (
          <p className="rounded-xl2 border border-ink-border bg-ink-surface p-4 text-sm text-ink-muted">
            {t("permissions.leaderboardHiddenForPlayer")}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-command-gradient" />
            {t("dashboard.latestAnnouncements")}
          </h2>
          <Link href="/announcements" className="text-sm text-command hover:underline">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        <div className="space-y-3 lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:gap-4 lg:space-y-0">
          {(announcements ?? []).length === 0 && (
            <p className="text-sm text-ink-muted">{t("dashboard.noAnnouncements")}</p>
          )}
          {(announcements ?? []).map((a: any) => (
            <div key={a.id} className="rounded-xl2 glass-card gradient-border p-4 lg:p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-ink-faint font-mono">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: dateLocale })}
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
