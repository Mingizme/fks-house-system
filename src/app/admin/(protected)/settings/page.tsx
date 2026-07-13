import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { getServerTranslator } from "@/lib/i18n-server";

const EMOJIS = ["🙂", "😎", "🐺", "🔥", "🦁", "🦏", "⚡", "🎯", "🛡️", "🗡️", "🌙", "☀️"];

export default async function AdminSettingsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileColumns =
    "id, email, username, display_name, avatar_emoji, avatar_url, bio, display_name_changed_at, chat_markdown_settings, user_type, admin_rank, department_id, role_title_override, department:departments(id, key, name, director_title, deputy_director_title, member_title, director_title_editing_enabled, deputy_director_title_editing_enabled, member_title_editing_enabled, sort_order, created_at)";
  const legacyProfileColumns = "id, email, username, display_name, avatar_emoji, avatar_url, bio, display_name_changed_at";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", user!.id)
    .single();

  const resolvedProfile = profileError
    ? (
        await supabase
          .from("profiles")
          .select(legacyProfileColumns)
          .eq("id", user!.id)
          .single()
      ).data
    : profile;

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("profile.kicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("profile.title")}</h1>
      </header>
      <ProfileForm profile={resolvedProfile!} emojiOptions={EMOJIS} />
    </main>
  );
}
