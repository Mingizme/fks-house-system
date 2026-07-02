import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";

const EMOJIS = ["🙂", "😎", "🐺", "🔥", "🦁", "🦏", "⚡", "🎯", "🛡️", "🗡️", "🌙", "☀️"];

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_emoji, username")
    .eq("id", user!.id)
    .single();

  return (
    <main className="p-8 max-w-lg mx-auto">
      <header className="mb-6">
        <p className="text-ink-muted font-mono text-xs mb-1">CÀI ĐẶT</p>
        <h1 className="font-display font-bold text-3xl">Hồ sơ của bạn</h1>
      </header>
      <ProfileForm profile={profile!} emojiOptions={EMOJIS} />
    </main>
  );
}
