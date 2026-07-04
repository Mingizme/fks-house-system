import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile — House System",
  description: "Customize your user profile details, emoji, and account settings.",
};

const EMOJIS = ["🙂", "😎", "🐺", "🔥", "🦁", "🦏", "⚡", "🎯", "🛡️", "🗡️", "🌙", "☀️"];

export default async function ProfilePage() {
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
    <main className="p-8 max-w-2xl mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">{t("profile.kicker")}</p>
        <h1 className="font-display font-bold text-3xl">{t("profile.title")}</h1>
      </header>
      <ProfileForm profile={profile!} emojiOptions={EMOJIS} />
    </main>
  );
}
