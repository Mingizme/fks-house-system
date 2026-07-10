import { createClient } from "@/lib/supabase/server";
import { AssignHouseSelect } from "@/components/AssignHouseSelect";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Management — FKS System",
  description: "Assign players to houses and manage player accounts.",
};

export default async function AdminPlayersPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();

  const [{ data: players }, { data: houses }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, avatar_emoji, house_id, created_at")
      .eq("user_type", "player")
      .order("created_at", { ascending: false }),
    supabase.from("houses").select("*").order("name"),
  ]);

  const unassigned = (players ?? []).filter((p) => !p.house_id);
  const assigned = (players ?? []).filter((p) => p.house_id);

  return (
    <main className="p-8 max-w-5xl mx-auto animate-fadeRise">
      <header className="mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("admin.playersKicker")}</p>
        <h1 className="font-display font-bold text-3xl">Player & House</h1>
        <p className="text-ink-muted text-sm mt-1">
          {t("admin.playersSummary", { total: players?.length ?? 0, unassigned: unassigned.length })}
        </p>
      </header>

      {unassigned.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display font-bold text-lg mb-3 text-command">
            {t("admin.unassignedTitle", { count: unassigned.length })}
          </h2>
          <div className="rounded-xl2 border border-command/30 bg-command/5 divide-y divide-ink-border">
            {unassigned.map((p) => (
              <PlayerRow key={p.id} player={p} houses={houses ?? []} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-3">{t("admin.assignedTitle", { count: assigned.length })}</h2>
        <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border">
          {assigned.map((p) => (
            <PlayerRow key={p.id} player={p} houses={houses ?? []} />
          ))}
          {assigned.length === 0 && <p className="text-sm text-ink-muted p-4">{t("admin.noAssigned")}</p>}
        </div>
      </section>
    </main>
  );
}

function PlayerRow({ player, houses }: { player: any; houses: any[] }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-lg">{player.avatar_emoji ?? "🙂"}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{player.display_name}</p>
        <p className="text-xs text-ink-faint font-mono">@{player.username}</p>
      </div>
      <AssignHouseSelect playerId={player.id} currentHouseId={player.house_id} houses={houses} />
    </div>
  );
}
