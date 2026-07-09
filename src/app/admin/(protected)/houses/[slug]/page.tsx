import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseCrest } from "@/components/HouseCrest";
import { HouseTabs } from "@/components/HouseTabs";
import { HouseChatLayout } from "@/components/HouseChatLayout";
import { AddPointsForm } from "@/components/AddPointsForm";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import { HouseLeadershipSelect } from "@/components/HouseLeadershipSelect";
import { AdminMuteControl } from "@/components/AdminMuteControl";
import { MemberPopover } from "@/components/MemberPopover";
import { formatPoints, houseRoleKey } from "@/lib/utils";
import { getServerTranslator } from "@/lib/i18n-server";
import { canMute, canManage } from "@/lib/permissions";
import type { ActorContext } from "@/lib/permissions";
import type { AdminRank, HouseSlug, HouseScoreVisibility, HouseMasterToggle } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";

const HOUSE_MOTTO_KEYS: Record<HouseSlug, TranslationKey> = {
  "arctic-wolves": "house.motto.arcticWolves",
  "inferno-phoenix": "house.motto.infernoPhoenix",
  "noble-lions": "house.motto.nobleLions",
  "ironclad-rhinos": "house.motto.ironcladRhinos",
};

export default async function AdminHousePage({ params }: { params: { slug: string } }) {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: house } = await supabase
    .from("houses")
    .select("id, name, slug, color, icon, description, score_visibility, master_can_toggle_score")
    .eq("slug", params.slug)
    .single();
  if (!house) notFound();

  // Lấy actor để quyết định UI mute
  const { data: me } = await supabase
    .from("profiles")
    .select("id, user_type, admin_rank, department_id")
    .eq("id", user.id)
    .single();
  if (!me || me.user_type !== "admin") redirect("/admin");
  const actor: ActorContext = {
    id: me.id,
    userType: me.user_type,
    adminRank: me.admin_rank as AdminRank | null,
    departmentId: me.department_id,
  };

  const scoreVisibility: HouseScoreVisibility = (house.score_visibility as HouseScoreVisibility) ?? "visible";
  const masterCanToggle: HouseMasterToggle = (house.master_can_toggle_score as HouseMasterToggle) ?? "allowed";

  const [
    { data: pointsRow },
    { data: leaderboard },
    { data: roster },
    { data: history },
    { data: messages },
    { data: masterBlockRow },
  ] = await Promise.all([
    supabase.from("house_points").select("total_points").eq("house_id", house.id).single(),
    supabase
      .from("house_points")
      .select("*")
      .order("total_points", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, house_role, muted_until, mute_reason")
      .eq("house_id", house.id)
      .order("display_name"),
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
    Promise.resolve({ data: null } as any),
  ]);

  void masterBlockRow;

  const profileBasePath = "/admin/profile";
  const messagesBasePath = "/admin/messages";
  const totalPoints = pointsRow?.total_points ?? 0;

  return (
    <main className="w-full p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-8">
        <HouseCrest color={house.color} icon={house.icon} size="lg" spin />
        <div>
          <h1 className="font-display font-extrabold text-3xl">{house.name}</h1>
          <p className="text-ink-muted text-sm">
            {t(HOUSE_MOTTO_KEYS[house.slug as HouseSlug] ?? "house.motto.arcticWolves")}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-ink-muted font-mono">{t("house.totalPoints")}</p>
          <p className="font-mono text-4xl font-bold">{totalPoints.toLocaleString()}</p>
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
              totalPoints={totalPoints}
              scoreVisibility={scoreVisibility}
              masterCanToggleScore={masterCanToggle}
              viewerCanSeeScore={true}
              roster={(roster as any) ?? []}
              profileBasePath={profileBasePath}
              messagesBasePath={messagesBasePath}
              canModerate={true}
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
              <div className="rounded-xl2 border border-ink-border bg-ink-surface p-2 max-h-64 overflow-y-auto space-y-0.5">
                {(roster ?? []).map((p: any) => {
                  const roleKey = houseRoleKey(p.house_role);
                  const target = {
                    id: p.id,
                    userType: "player" as const,
                    adminRank: null,
                    departmentId: null,
                  };
                  const muteAcceptable = canMute(actor, target);
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
                      extraSlot={
                        muteAcceptable ? (
                          <AdminMuteControl
                            targetId={p.id}
                            targetName={p.display_name}
                            targetEmoji={p.avatar_emoji}
                            blocked={null}
                            mutedUntil={p.muted_until}
                            muteReason={p.mute_reason}
                            canMute={muteAcceptable}
                          />
                        ) : null
                      }
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
              <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border max-h-96 overflow-y-auto">
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
