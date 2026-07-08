import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/AdminSidebar";
import { PresenceProvider } from "@/components/PresenceProvider";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji, avatar_url, user_type, admin_role, house_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "admin") redirect("/admin/login");

  return (
    <PresenceProvider
      userId={user.id}
      displayName={profile.display_name}
      avatarEmoji={profile.avatar_emoji}
      houseId={profile.house_id}
    >
      <div className="flex">
        <AdminSidebar
          displayName={profile.display_name}
          adminRole={profile.admin_role}
          avatarEmoji={profile.avatar_emoji ?? "🙂"}
          avatarUrl={profile.avatar_url}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </PresenceProvider>
  );
}
