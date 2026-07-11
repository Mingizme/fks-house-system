import { createClient } from "@/lib/supabase/server";
import { AdminMuteControl } from "@/components/AdminMuteControl";
import { getServerTranslator } from "@/lib/i18n-server";
import { canMute } from "@/lib/permissions";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ActorContext } from "@/lib/permissions";
import type { AdminRank } from "@/lib/types";

export const metadata: Metadata = {
  title: "Player Moderation - FKS System",
  description: "Mute, chat-ban, account-ban, and IP-ban players.",
};

type SupabaseServerClient = ReturnType<typeof createClient>;

const PLAYER_SELECT_WITH_MODERATION =
  "id, display_name, username, avatar_emoji, avatar_url, house_id, created_at, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip";
const PLAYER_SELECT_WITH_MUTE =
  "id, display_name, username, avatar_emoji, avatar_url, house_id, created_at, muted_until, mute_reason";
const PLAYER_SELECT_BASE =
  "id, display_name, username, avatar_emoji, avatar_url, house_id, created_at";

async function getPlayers(supabase: SupabaseServerClient) {
  const withModeration = await supabase
    .from("profiles")
    .select(PLAYER_SELECT_WITH_MODERATION)
    .eq("user_type", "player")
    .order("created_at", { ascending: false });
  if (!withModeration.error) return withModeration.data ?? [];

  const withMute = await supabase
    .from("profiles")
    .select(PLAYER_SELECT_WITH_MUTE)
    .eq("user_type", "player")
    .order("created_at", { ascending: false });
  if (!withMute.error) return withMute.data ?? [];

  const base = await supabase
    .from("profiles")
    .select(PLAYER_SELECT_BASE)
    .eq("user_type", "player")
    .order("created_at", { ascending: false });
  return base.data ?? [];
}

async function getActiveIpBans(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("ip_bans")
    .select("ip_address, reason, created_at")
    .is("lifted_at", null);
  return error ? [] : data ?? [];
}

export default async function PlayerModerationPage() {
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

  const [players, ipBans] = await Promise.all([
    getPlayers(supabase),
    getActiveIpBans(supabase),
  ]);

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("admin.playersKicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("nav.playerModeration")}</h1>
        <p className="text-ink-muted text-sm mt-1">{t("admin.moderationSummary", { total: players.length })}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 lg:gap-5">
        {players.map((player) => (
          <PlayerModerationCard
            key={player.id}
            player={player}
            actor={actor}
            ipBans={ipBans as any[]}
          />
        ))}
        {players.length === 0 && <p className="text-sm text-ink-muted p-4">{t("admin.noPlayers")}</p>}
      </section>
    </main>
  );
}

function PlayerModerationCard({
  player,
  actor,
  ipBans,
}: {
  player: any;
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
  );
}
