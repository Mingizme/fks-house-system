"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

export function NewAnnouncementForm({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError(t("announcements.missingFields"));
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase
      .from("announcements")
      .insert({ admin_id: adminId, title: title.trim(), content: content.trim() });
    setSaving(false);
    if (insertError) {
      setError(t("announcements.saveFailed"));
      return;
    }
    setTitle("");
    setContent("");
    router.refresh();
  }

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5 mb-8 lg:mb-0 lg:p-6">
      <p className="font-display font-bold mb-4 lg:text-xl">{t("announcements.newTitle")}</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("announcements.titlePlaceholder")}
        aria-label={t("announcements.titlePlaceholder")}
        className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command mb-3 lg:py-3 lg:text-base"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("announcements.contentPlaceholder")}
        aria-label={t("announcements.contentPlaceholder")}
        rows={4}
        className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command mb-3 resize-none lg:min-h-[180px] lg:py-3 lg:text-base"
      />
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm lg:px-6 lg:py-3 lg:text-base"
      >
        {saving ? t("announcements.posting") : t("announcements.post")}
      </button>
    </div>
  );
}
