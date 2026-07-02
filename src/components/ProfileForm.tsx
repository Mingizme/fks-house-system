"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ProfileForm({
  profile,
  emojiOptions,
}: {
  profile: { id: string; display_name: string; avatar_emoji: string | null; username: string };
  emojiOptions: string[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [emoji, setEmoji] = useState(profile.avatar_emoji ?? "🙂");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await supabase.from("profiles").update({ display_name: displayName, avatar_emoji: emoji }).eq("id", profile.id);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5">
        <p className="text-xs text-ink-muted font-mono mb-4">@{profile.username}</p>

        <label className="text-xs font-mono text-ink-muted block mb-1.5">TÊN HIỂN THỊ</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors mb-4"
        />

        <label className="text-xs font-mono text-ink-muted block mb-2">BIỂU TƯỢNG</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {emojiOptions.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border transition-colors ${
                emoji === e ? "border-command bg-command/15" : "border-ink-border hover:border-ink-faint"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm"
        >
          {saving ? "Đang lưu..." : saved ? "Đã lưu ✓" : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}
