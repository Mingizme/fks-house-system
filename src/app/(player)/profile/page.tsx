import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile — FKS System",
  description: "Customize your user profile details, emoji, and account settings.",
};

const EMOJIS = ["🙂", "😎", "🐺", "🔥", "🦁", "🦏", "⚡", "🎯", "🛡️", "🗡️", "🌙", "☀️"];

export default async function ProfilePage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileColumns = "id, email, username, display_name, avatar_emoji, avatar_url, bio, display_name_changed_at, chat_markdown_settings";
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
    <main className="p-8 max-w-2xl mx-auto lg:w-full lg:max-w-[1800px] lg:p-10 2xl:p-12 animate-fadeRise">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("profile.kicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("profile.title")}</h1>
      </header>
      <ProfileForm profile={resolvedProfile!} emojiOptions={EMOJIS} />
    </main>
  );
}
