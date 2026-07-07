import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseCrest } from "@/components/HouseCrest";
import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n-server";
import { format } from "date-fns";
import { ADMIN_ROLE_LABELS } from "@/lib/types";
import type { AdminRole } from "@/lib/types";
import { houseRoleKey } from "@/lib/utils";

export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  const { t, dateLocale } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_emoji, avatar_url, bio, user_type, admin_role, house_role, house_id, created_at")
    .eq("id", params.id)
    .single();

  if (!profile) notFound();

  // Fetch house info if the user belongs to one
  const { data: house } = profile.house_id
    ? await supabase.from("houses").select("id, name, slug, color, icon").eq("id", profile.house_id).single()
    : { data: null };

  const isSelf = user.id === profile.id;
  const joinedDate = format(new Date(profile.created_at), "d MMMM yyyy", { locale: dateLocale });

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <Link href="/messages" className="text-ink-muted text-sm font-mono hover:text-ink-text">
        ← {t("messages.title")}
      </Link>

      <div className="mt-6 rounded-xl2 border border-ink-border bg-ink-surface p-6">
        {/* Avatar & Name */}
        <div className="flex items-center gap-5 mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-ink-surface2 border border-ink-border flex items-center justify-center text-4xl shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              profile.avatar_emoji ?? "🙂"
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl truncate">{profile.display_name}</h1>
            <p className="text-sm text-ink-muted font-mono">@{profile.username}</p>
            {profile.user_type === "admin" && profile.admin_role && (
              <span className="inline-block mt-1 text-xs font-mono text-command bg-command/10 border border-command/30 rounded-md px-2 py-0.5">
                {ADMIN_ROLE_LABELS[profile.admin_role as AdminRole]}
              </span>
            )}
            {profile.house_role && houseRoleKey(profile.house_role) && (
              <span className="inline-block mt-1 ml-1 text-xs font-mono text-success bg-success/10 border border-success/30 rounded-md px-2 py-0.5">
                {t(houseRoleKey(profile.house_role)!)}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="mb-6">
          <p className="text-xs font-mono text-ink-muted mb-1.5">{t("profile.bioLabel")}</p>
          <p className="text-sm text-ink-text whitespace-pre-wrap leading-relaxed">
            {profile.bio || t("profile.noBio")}
          </p>
        </div>

        {/* House */}
        {house && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-ink-surface2 px-4 py-3 border border-ink-border">
            <HouseCrest color={house.color} icon={house.icon} size="sm" />
            <div>
              <p className="font-semibold text-sm">{house.name}</p>
              <Link href={`/house/${house.slug}`} className="text-xs text-command hover:underline">
                {t("member.viewProfile")} →
              </Link>
            </div>
          </div>
        )}

        {/* Join date */}
        <p className="text-xs text-ink-faint font-mono mb-6">
          {t("profile.joinedAt", { date: joinedDate })}
        </p>

        {/* Actions */}
        {!isSelf && (
          <Link
            href={`/messages/${profile.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-command hover:bg-command/85 transition-colors font-semibold px-5 py-2.5 text-sm"
          >
            💬 {t("profile.sendMessage")}
          </Link>
        )}
      </div>
    </main>
  );
}
