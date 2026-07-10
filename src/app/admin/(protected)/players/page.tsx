import { createClient } from "@/lib/supabase/server";
import { AssignHouseSelect } from "@/components/AssignHouseSelect";
import { AdminMuteControl } from "@/components/AdminMuteControl";
import { getServerTranslator } from "@/lib/i18n-server";
import { canMute } from "@/lib/permissions";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ActorContext } from "@/lib/permissions";
import type { AdminRank } from "@/lib/types";

export const metadata: Metadata = {
  title: "Player Management - FKS System",
  description: "Assign players to houses and manage player accounts.",
};

export default async function AdminPlayersPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, user_type, admin_rank, department_id")
    .eq("id", user.id)
    .single();
  if (!me || me.user_type !== "admin") redirect("/login");

  const actor: ActorContext = {
    id: me.id,
    userType: me.user_type,
    adminRank: me.admin_rank as AdminRank | null,
    departmentId: me.department_id,
  };

  const [{ data: players }, { data: houses }, { data: ipBans }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, username, avatar_emoji, avatar_url, house_id, created_at, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip"
      )
      .eq("user_type", "player")
      .order("created_at", { ascending: false }),
    supabase.from("houses").select("*").order("name"),
    supabase.from("ip_bans").select("ip_address, reason, created_at").is("lifted_at", null),
  ]);

  const unassigned = (players ?? []).filter((p) => !p.house_id);
  const assigned = (players ?? []).filter((p) => p.house_id);

  return (
    <main className="p-8 max-w-6xl mx-auto animate-fadeRise">
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
              <PlayerRow
                key={p.id}
                player={p}
                houses={houses ?? []}
                actor={actor}
                ipBans={(ipBans as any[]) ?? []}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-3">{t("admin.assignedTitle", { count: assigned.length })}</h2>
        <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border">
          {assigned.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              houses={houses ?? []}
              actor={actor}
              ipBans={(ipBans as any[]) ?? []}
            />
          ))}
          {assigned.length === 0 && <p className="text-sm text-ink-muted p-4">{t("admin.noAssigned")}</p>}
        </div>
      </section>
    </main>
  );
}

function PlayerRow({
  player,
  houses,
  actor,
  ipBans,
}: {
  player: any;
  houses: any[];
  actor: ActorContext;
  ipBans: any[];
}) {
  const target = {
    id: player.id,
    userType: "player" as const,
    adminRank: null,
    departmentId: null,
  };
  const canModerate = canMute(actor, target);
  const activeIpBan = player.last_seen_ip
    ? ipBans.find((ban) => ban.ip_address === player.last_seen_ip)
    : null;

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_minmax(280px,360px)] lg:items-start">
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

      <AdminMuteControl
        targetId={player.id}
        targetName={player.display_name}
        targetEmoji={player.avatar_emoji}
        blocked={null}
        mutedUntil={player.muted_until}
        muteReason={player.mute_reason}
        chatBannedAt={player.chat_banned_at}
        chatBanReason={player.chat_ban_reason}
        accountBannedAt={player.account_banned_at}
        accountBanReason={player.account_ban_reason}
        lastSeenIp={player.last_seen_ip}
        ipBannedAt={activeIpBan?.created_at ?? null}
        ipBanReason={activeIpBan?.reason ?? null}
        canMute={canModerate}
      />
    </div>
  );
}
