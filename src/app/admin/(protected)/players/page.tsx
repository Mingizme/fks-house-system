import { createClient } from "@/lib/supabase/server";
import { AssignHouseSelect } from "@/components/AssignHouseSelect";
import { getServerTranslator } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "House Assignment - FKS System",
  description: "Assign players to houses.",
};

type SupabaseServerClient = ReturnType<typeof createClient>;

const PLAYER_SELECT_BASE =
  "id, display_name, username, avatar_emoji, avatar_url, house_id, created_at";

async function getPlayers(supabase: SupabaseServerClient) {
  const { data } = await supabase
    .from("profiles")
    .select(PLAYER_SELECT_BASE)
    .eq("user_type", "player")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function AdminPlayersPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  if (!me || me.user_type !== "admin") redirect("/login");

  const [players, { data: houses }] = await Promise.all([
    getPlayers(supabase),
    supabase.from("houses").select("*").order("name"),
  ]);

  const unassigned = players.filter((p) => !p.house_id);
  const assigned = players.filter((p) => p.house_id);

  return (
    <main className="p-8 max-w-5xl mx-auto animate-fadeRise">
      <header className="mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("admin.playersKicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("nav.assignHouses")}</h1>
        <p className="text-ink-muted text-sm mt-1">
          {t("admin.playersSummary", { total: players.length, unassigned: unassigned.length })}
        </p>
      </header>

      {unassigned.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display font-bold text-lg mb-3 text-command">
            {t("admin.unassignedTitle", { count: unassigned.length })}
          </h2>
          <div className="rounded-xl2 border border-command/30 bg-command/5 divide-y divide-ink-border">
            {unassigned.map((p) => (
              <PlayerAssignmentRow key={p.id} player={p} houses={houses ?? []} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-3">{t("admin.assignedTitle", { count: assigned.length })}</h2>
        <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border">
          {assigned.map((p) => (
            <PlayerAssignmentRow key={p.id} player={p} houses={houses ?? []} />
          ))}
          {assigned.length === 0 && <p className="text-sm text-ink-muted p-4">{t("admin.noAssigned")}</p>}
        </div>
      </section>
    </main>
  );
}

function PlayerAssignmentRow({ player, houses }: { player: any; houses: any[] }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden shrink-0">
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            player.avatar_emoji ?? ":)"
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{player.display_name}</p>
          <p className="text-xs text-ink-faint font-mono truncate">@{player.username}</p>
        </div>
      </div>

      <AssignHouseSelect playerId={player.id} currentHouseId={player.house_id} houses={houses} />
    </div>
  );
}
