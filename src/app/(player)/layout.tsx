import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayerSidebar } from "@/components/PlayerSidebar";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_emoji, avatar_url, user_type, house:houses(name, slug, color, icon)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.user_type === "admin") redirect("/admin");

  const house = Array.isArray(profile.house) ? profile.house[0] : profile.house;

  return (
    <div className="flex">
      <PlayerSidebar
        displayName={profile.display_name}
        avatarEmoji={profile.avatar_emoji ?? "🙂"}
        avatarUrl={profile.avatar_url}
        house={house ?? null}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
