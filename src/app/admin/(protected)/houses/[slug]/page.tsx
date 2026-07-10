import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseCrest } from "@/components/HouseCrest";
import { HouseTabs } from "@/components/HouseTabs";
import { HouseChatLayout } from "@/components/HouseChatLayout";
import { AddPointsForm } from "@/components/AddPointsForm";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import { HouseLeadershipSelect } from "@/components/HouseLeadershipSelect";
import { MemberPopover } from "@/components/MemberPopover";
import { formatPoints, houseRoleKey } from "@/lib/utils";
import { getServerTranslator } from "@/lib/i18n-server";
import type { HouseSlug } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";

const HOUSE_MOTTO_KEYS: Record<HouseSlug, TranslationKey> = {
  "arctic-wolves": "house.motto.arcticWolves",
  "inferno-phoenix": "house.motto.infernoPhoenix",
  "noble-lions": "house.motto.nobleLions",
  "ironclad-rhinos": "house.motto.ironcladRhinos",
};

type SupabaseServerClient = ReturnType<typeof createClient>;

const HOUSE_SELECT_WITH_SCORE =
  "id, name, slug, color, icon, description, score_visibility, master_can_toggle_score";
const HOUSE_SELECT_BASE = "id, name, slug, color, icon, description";
const ROSTER_SELECT_WITH_MODERATION =
  "id, display_name, avatar_emoji, avatar_url, house_role, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip";
const ROSTER_SELECT_WITH_MUTE =
  "id, display_name, avatar_emoji, avatar_url, house_role, muted_until, mute_reason";
const ROSTER_SELECT_BASE = "id, display_name, avatar_emoji, avatar_url, house_role";

async function getHouseBySlug(supabase: SupabaseServerClient, slug: string) {
  const withScore = await supabase
    .from("houses")
    .select(HOUSE_SELECT_WITH_SCORE)
    .eq("slug", slug)
    .single();
  if (!withScore.error) return withScore.data;

  const base = await supabase
    .from("houses")
    .select(HOUSE_SELECT_BASE)
    .eq("slug", slug)
    .single();
  return base.data;
}

async function getHouseRoster(supabase: SupabaseServerClient, houseId: string) {
  const withModeration = await supabase
    .from("profiles")
    .select(ROSTER_SELECT_WITH_MODERATION)
    .eq("house_id", houseId)
    .order("display_name");
  if (!withModeration.error) return withModeration.data ?? [];

  const withMute = await supabase
    .from("profiles")
    .select(ROSTER_SELECT_WITH_MUTE)
    .eq("house_id", houseId)
    .order("display_name");
  if (!withMute.error) return withMute.data ?? [];

  const base = await supabase
    .from("profiles")
    .select(ROSTER_SELECT_BASE)
    .eq("house_id", houseId)
    .order("display_name");
  return base.data ?? [];
}

async function getActiveIpBans(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("ip_bans")
    .select("ip_address, reason, created_at")
    .is("lifted_at", null);
  return error ? [] : data ?? [];
}

export default async function AdminHousePage({ params }: { params: { slug: string } }) {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const house = await getHouseBySlug(supabase, params.slug);
  if (!house) notFound();

  // Lấy actor để quyết định UI mute
  const { data: me } = await supabase
    .from("profiles")
    .select("id, user_type, admin_rank, department_id")
    .eq("id", user.id)
    .single();
  if (!me || me.user_type !== "admin") redirect("/admin");

  const [
    { data: pointsRow },
    { data: leaderboard },
    roster,
    { data: history },
    { data: messages },
    ipBans,
  ] = await Promise.all([
    supabase.from("house_points").select("total_points").eq("house_id", house.id).single(),
    supabase
      .from("house_points")
      .select("*")
      .order("total_points", { ascending: false }),
    getHouseRoster(supabase, house.id),
    supabase
      .from("point_transactions")
      .select("id, points, reason, created_at, admin:profiles(display_name, admin_role)")
      .eq("house_id", house.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("house_messages")
      .select("id, house_id, sender_id, content, created_at, edited_at, deleted_at, reply_to_id, media_url, media_type, sender:profiles(display_name, avatar_emoji, avatar_url, user_type, admin_role, house_role)")
      .eq("house_id", house.id)
      .order("created_at", { ascending: true })
      .limit(100),
    getActiveIpBans(supabase),
  ]);

  const profileBasePath = "/admin/profile";
  const messagesBasePath = "/admin/messages";
  const totalPoints = pointsRow?.total_points ?? 0;

  return (
    <main className="w-full p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-xl2 glass-card p-6 mb-8 animate-fadeRise">
        <div className="absolute -top-20 -right-10 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: house.color === "phoenix" ? "rgba(255,92,57,0.18)" : "rgba(139,92,246,0.18)" }} />
        <div className="relative flex items-center gap-4">
          <HouseCrest color={house.color} icon={house.icon} size="lg" spin />
          <div>
            <h1 className="font-display font-extrabold text-3xl">{house.name}</h1>
            <p className="text-ink-muted text-sm">
              {t(HOUSE_MOTTO_KEYS[house.slug as HouseSlug] ?? "house.motto.arcticWolves")}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-ink-muted font-mono uppercase tracking-wider">{t("house.totalPoints")}</p>
            <p className="font-mono text-4xl font-bold tabular-nums text-gradient">{totalPoints.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <HouseTabs
        defaultTab="chat"
        chatSlot={
          <div className="space-y-6">
            <AddPointsForm houseId={house.id} adminId={user.id} />
            <HouseChatLayout
              houseId={house.id}
              currentUserId={user.id}
              currentDisplayName="admin"
              currentAvatarEmoji={null}
              initialMessages={(messages as any) ?? []}
              roster={(roster as any) ?? []}
              profileBasePath={profileBasePath}
              messagesBasePath={messagesBasePath}
              canModerate={true}
              canModerateMembers={true}
              activeIpBans={(ipBans as any) ?? []}
              editableName="admin"
            />
            <HouseLeadershipSelect roster={(roster as any) ?? []} />
          </div>
        }
        leaderboardSlot={
          <div className="space-y-6">
            <HousePointsBoard initial={(leaderboard as any) ?? []} linkPrefix="/admin/houses" />
            <div>
              <h2 className="font-display font-bold text-lg mb-3">{t("house.members")}</h2>
              <div className="rounded-xl2 glass-card p-2 max-h-64 overflow-y-auto space-y-0.5">
                {(roster ?? []).map((p: any) => {
                  const roleKey = houseRoleKey(p.house_role);
                  return (
                    <MemberPopover
                      key={p.id}
                      memberId={p.id}
                      displayName={p.display_name}
                      avatarEmoji={p.avatar_emoji}
                      roleLabel={roleKey ? t(roleKey) : null}
                      messagesBasePath={messagesBasePath}
                      profileBasePath={profileBasePath}
                      currentUserId={user.id}
                      presenceDot
                    />
                  );
                })}
                {(roster ?? []).length === 0 && (
                  <p className="text-sm text-ink-muted p-3">{t("house.noMembers")}</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="font-display font-bold text-lg mb-3">{t("house.pointHistory")}</h2>
              <div className="rounded-xl2 glass-card divide-y divide-ink-border/60 max-h-96 overflow-y-auto">
                {(history ?? []).map((tx: any) => (
                  <div key={tx.id} className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{tx.reason}</p>
                      <p className="text-xs text-ink-faint font-mono">
                        {t("common.byWithRole", { name: tx.admin?.display_name ?? "", role: tx.admin?.admin_role ?? "" })}
                      </p>
                    </div>
                    <span className={`font-mono text-sm font-bold shrink-0 ${tx.points >= 0 ? "text-success" : "text-danger"}`}>
                      {formatPoints(tx.points)}
                    </span>
                  </div>
                ))}
                {(history ?? []).length === 0 && (
                  <p className="text-sm text-ink-muted p-3">{t("house.noTransactions")}</p>
                )}
              </div>
            </div>
          </div>
        }
      />
    </main>
  );
}
