import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseCrest } from "@/components/HouseCrest";
import { HouseChatLayout } from "@/components/HouseChatLayout";
import { getServerTranslator } from "@/lib/i18n-server";
import type { HouseSlug, HouseScoreVisibility } from "@/lib/types";
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

  const [
    { data: points },
    { data: roster },
    { data: messages },
    { data: masterBlockRow },
    { data: viewerMute },
  ] = await Promise.all([
    supabase.from("house_points").select("total_points").eq("house_id", house.id).single(),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, house_role, username")
      .eq("house_id", house.id)
      .order("display_name"),
    supabase
      .from("house_messages")
      .select("id, house_id, sender_id, content, created_at, edited_at, deleted_at, reply_to_id, media_url, media_type, sender:profiles(display_name, avatar_emoji, avatar_url, user_type, admin_role, house_role)")
      .eq("house_id", house.id)
      .order("created_at", { ascending: false })
      .limit(100),
    isMember && profile?.house_role === "master"
      ? supabase.from("house_master_score_blocks").select("id").eq("master_id", user.id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.rpc("get_mute_status", { user_id: user.id }),
  ]);

  const isMasterBlocked = !!masterBlockRow?.id;
  const scoreVisibility: HouseScoreVisibility = (house.score_visibility as HouseScoreVisibility) ?? "visible";
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
  void viewerMute;

  return (
    <main className="w-full p-6 lg:p-8">
      <div className="hidden lg:block relative overflow-hidden rounded-xl2 glass-card p-6 mb-8 animate-fadeRise">
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
            {viewerCanSeeScore ? (
              <p className="font-mono text-4xl font-bold tabular-nums text-gradient">{totalPoints.toLocaleString()}</p>
            ) : (
              <p className="font-mono text-4xl font-bold text-ink-faint">•••</p>
            )}
          </div>
        </div>
      </div>

      <HouseChatLayout
        houseId={house.id}
        currentUserId={user.id}
        currentDisplayName={profile?.house_role ?? ""}
        currentAvatarEmoji={null}
        initialMessages={(((messages as any[]) ?? []).slice().reverse() as any)}
        roster={(roster as any) ?? []}
        profileBasePath={profileBasePath}
        messagesBasePath={messagesBasePath}
        canModerate={canModerate}
        editableName={isAdmin ? "admin" : "player"}
        houseName={house.name}
        totalPoints={totalPoints}
        viewerCanSeeScore={viewerCanSeeScore}
      />
    </main>
  );
}
