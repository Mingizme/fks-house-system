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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, username, display_name, avatar_emoji, avatar_url, bio, display_name_changed_at")
    .eq("id", user!.id)
    .single();

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("profile.kicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("profile.title")}</h1>
      </header>
      <ProfileForm profile={profile!} emojiOptions={EMOJIS} />
    </main>
  );
}
