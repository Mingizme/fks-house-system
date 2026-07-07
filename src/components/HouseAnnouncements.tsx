"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HouseAnnouncement } from "@/lib/types";
import { format } from "date-fns";
import { useI18n } from "@/components/I18nProvider";

interface Props {
  houseId: string;
  currentUserId: string;
  initial: HouseAnnouncement[];
  canManage: boolean;
}

export function HouseAnnouncements({ houseId, currentUserId, initial, canManage }: Props) {
  const supabase = createClient();
  const { t, dateLocale } = useI18n();
  const [items, setItems] = useState<HouseAnnouncement[]>(initial);

  // Compose form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`house-ann-${houseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "house_announcements", filter: `house_id=eq.${houseId}` },
        async (payload) => {
          const row = payload.new as HouseAnnouncement;
          setItems((prev) => {
            if (prev.some((a) => a.id === row.id)) return prev;
            return [row, ...prev];
          });
          const { data: author } = await supabase
            .from("profiles")
            .select("display_name, avatar_emoji, house_role")
            .eq("id", row.author_id)
            .single();
          if (author) {
            setItems((prev) => prev.map((a) => (a.id === row.id ? { ...a, author } : a)));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "house_announcements", filter: `house_id=eq.${houseId}` },
        (payload) => {
          const old = payload.old as { id: string };
          setItems((prev) => prev.filter((a) => a.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, houseId]);

  async function submit() {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError(t("announcements.missingFields"));
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("house_announcements").insert({
      house_id: houseId,
      author_id: currentUserId,
      title: title.trim(),
      content: content.trim(),
    });
    setSaving(false);
    if (insertError) {
      setError(t("announcements.saveFailed"));
      return;
    }
    setTitle("");
    setContent("");
  }

  async function remove(id: string) {
    if (!window.confirm(t("chat.confirmDelete"))) return;
    const { error: delError } = await supabase.from("house_announcements").delete().eq("id", id);
    if (!delError) {
      setItems((prev) => prev.filter((a) => a.id !== id));
    }
  }

  return (
    <div>
      {canManage && (
        <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5 mb-8">
          <p className="font-display font-bold mb-4">{t("houseAnn.newTitle")}</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("announcements.titlePlaceholder")}
            aria-label={t("announcements.titlePlaceholder")}
            className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command mb-3"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("announcements.contentPlaceholder")}
            aria-label={t("announcements.contentPlaceholder")}
            rows={4}
            className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command mb-3 resize-none"
          />
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm"
          >
            {saving ? t("announcements.posting") : t("houseAnn.post")}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("houseAnn.empty")}</p>
      ) : (
        <div className="space-y-4" role="feed" aria-label={t("houseAnn.title")}>
          {items.map((a) => (
            <article key={a.id} className="rounded-xl2 border border-ink-border bg-ink-surface p-5">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="font-display font-bold text-lg">{a.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-ink-faint font-mono">
                    {format(new Date(a.created_at), "d MMM, HH:mm", { locale: dateLocale })}
                  </span>
                  {(canManage || a.author_id === currentUserId) && (
                    <button
                      onClick={() => remove(a.id)}
                      aria-label={t("chat.delete")}
                      className="text-xs text-ink-muted hover:text-danger transition-colors"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">{a.content}</p>
              {a.author && (
                <p className="text-xs text-command mt-3 font-mono">
                  — {a.author.display_name}
                  {a.author.house_role ? ` · ${t(a.author.house_role === "master" ? "role.houseMaster" : "role.viceMaster")}` : ""}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
