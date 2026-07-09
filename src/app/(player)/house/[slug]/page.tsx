import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseCrest } from "@/components/HouseCrest";
import { HouseTabs } from "@/components/HouseTabs";
import { HouseChatLayout } from "@/components/HouseChatLayout";
import { HousePointsBoard } from "@/components/HousePointsBoard";
import { getServerTranslator } from "@/lib/i18n-server";
import type { HouseSlug, HouseScoreVisibility, HouseMasterToggle } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";

const HOUSE_MOTTO_KEYS: Record<HouseSlug, TranslationKey> = {
  "arctic-wolves": "house.motto.arcticWolves",
  "inferno-phoenix": "house.motto.infernoPhoenix",
  "noble-lions": "house.motto.nobleLions",
  "ironclad-rhinos": "house.motto.ironcladRhinos",
};

export default async function HousePage({ params }: { params: { slug: string } }) {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: house } = await supabase
    .from("houses")
    .select("id, name, slug, color, icon, description, score_visibility, master_can_toggle_score")
    .eq("slug", params.slug)
    .single();
  if (!house) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("house_id, user_type, house_role")
    .eq("id", user.id)
    .single();

  const isMember = profile?.house_id === house.id;
  const isAdmin = profile?.user_type === "admin";
  if (!isMember && !isAdmin) redirect("/dashboard");

  const canModerate = isMember && (profile?.house_role === "master" || profile?.house_role === "vice");

  const messagesBasePath = isAdmin ? "/admin/messages" : "/messages";
  const profileBasePath = isAdmin ? "/admin/profile" : "/profile";
  const { data: canViewLeaderboardData, error: canViewLeaderboardError } = await supabase.rpc("can_view_leaderboard");
  const canViewLeaderboard = canViewLeaderboardError ? true : canViewLeaderboardData !== false;

  const [
    { data: points },
    { data: leaderboard },
    { data: roster },
    { data: recentTx },
    { data: messages },
    { data: masterBlockRow },
    { data: viewerMute },
  ] = await Promise.all([
    supabase.from("house_points").select("total_points").eq("house_id", house.id).single(),
    canViewLeaderboard
      ? supabase
          .from("house_points")
          .select("*")
          .order("total_points", { ascending: false })
      : Promise.resolve({ data: [] } as any),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, house_role, username")
      .eq("house_id", house.id)
      .order("display_name"),
    canViewLeaderboard
      ? supabase
          .from("point_transactions")
          .select("id, points, reason, created_at, admin:profiles(display_name, admin_role)")
          .eq("house_id", house.id)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] } as any),
    supabase
      .from("house_messages")
      .select("id, house_id, sender_id, content, created_at, edited_at, deleted_at, reply_to_id, media_url, media_type, sender:profiles(display_name, avatar_emoji, avatar_url, user_type, admin_role, house_role)")
      .eq("house_id", house.id)
      .order("created_at", { ascending: true })
      .limit(100),
    isMember && profile?.house_role === "master"
      ? supabase.from("house_master_score_blocks").select("id").eq("master_id", user.id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.rpc("get_mute_status", { user_id: user.id }),
  ]);

  const isMasterBlocked = !!masterBlockRow?.id;
  const scoreVisibility: HouseScoreVisibility = (house.score_visibility as HouseScoreVisibility) ?? "visible";
  const masterCanToggle: HouseMasterToggle = (house.master_can_toggle_score as HouseMasterToggle) ?? "allowed";
  const totalPoints = points?.total_points ?? 0;

  // Quyết định viewer có được xem điểm house không
  // - admin: luôn xem
  // - master của house này, bị block: không
  // - thành viên house, score_visibility = hidden: không
  let viewerCanSeeScore = true;
  if (isAdmin) viewerCanSeeScore = true;
  else if (isMember && profile?.house_role === "master" && isMasterBlocked) viewerCanSeeScore = false;
  else if (isMember && scoreVisibility === "hidden") viewerCanSeeScore = false;

  // Có bị mute không? (viewer là member)
  const viewerMuted =
    !isAdmin && !!viewerMute?.data && !!(viewerMute.data as any)?.muted_until
      ? new Date((viewerMute.data as any).muted_until) > new Date()
      : false;

  // Xác định quyền xem leaderboard (chỉ để ẩn/hiện tab leaderboard)
  const hideLeaderboard = !canViewLeaderboard;

  void recentTx;

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
          {viewerCanSeeScore ? (
            <p className="font-mono text-4xl font-bold">{totalPoints.toLocaleString()}</p>
          ) : (
            <p className="font-mono text-4xl font-bold text-ink-faint">•••</p>
          )}
        </div>
      </div>

      <HouseTabs
        defaultTab="chat"
        hideLeaderboard={hideLeaderboard}
        chatSlot={
          <HouseChatLayout
            houseId={house.id}
            currentUserId={user.id}
            currentDisplayName={profile?.house_role ?? ""}
            currentAvatarEmoji={null}
            initialMessages={(messages as any) ?? []}
            totalPoints={totalPoints}
            scoreVisibility={scoreVisibility}
            masterCanToggleScore={masterCanToggle}
            viewerCanSeeScore={viewerCanSeeScore}
            roster={(roster as any) ?? []}
            profileBasePath={profileBasePath}
            messagesBasePath={messagesBasePath}
            canModerate={canModerate}
            editableName={isAdmin ? "admin" : "player"}
          />
        }
        leaderboardSlot={
          <div className="space-y-6">
            <HousePointsBoard
              initial={(leaderboard as any) ?? []}
              linkPrefix="/house"
              hiddenHouseIds={viewerCanSeeScore ? [] : [house.id]}
            />
            <div>
              <h2 className="font-display font-bold text-lg mb-3">{t("house.recentPointHistory")}</h2>
              <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border">
                {(recentTx ?? []).map((tx: any) => (
                  <div key={tx.id} className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{tx.reason}</p>
                      <p className="text-xs text-ink-faint font-mono">
                        {t("common.by", { name: tx.admin?.display_name ?? "" })}
                      </p>
                    </div>
                    <span className={`font-mono text-sm font-bold shrink-0 ${tx.points >= 0 ? "text-success" : "text-danger"}`}>
                      {tx.points >= 0 ? `+${tx.points}` : tx.points}
                    </span>
                  </div>
                ))}
                {(recentTx ?? []).length === 0 && (
                  <p className="text-sm text-ink-muted p-3">{t("house.noPointTransactions")}</p>
                )}
              </div>
            </div>
          </div>
        }
      />
    </main>
  );
}
