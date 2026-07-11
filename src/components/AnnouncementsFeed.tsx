"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Announcement } from "@/lib/types";
import { format } from "date-fns";
import { useI18n } from "@/components/I18nProvider";

export function AnnouncementsFeed({ initial }: { initial: Announcement[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<Announcement[]>(initial);
  const { t, dateLocale } = useI18n();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        async (payload) => {
          const row = payload.new as Announcement;
          const { data: admin } = await supabase
            .from("profiles")
            .select("display_name, admin_role")
            .eq("id", row.admin_id)
            .single();
          
          setItems((prev) => [
            { 
              ...row, 
              admin: admin || { display_name: "Admin", admin_role: null } 
            }, 
            ...prev
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{t("announcements.empty")}</p>;
  }

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 2xl:grid-cols-3" role="feed" aria-label={t("announcements.title")}>
      {items.map((a) => (
        <article key={a.id} className="rounded-xl2 border border-ink-border bg-ink-surface p-5 lg:p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-lg lg:text-xl">{a.title}</h3>
            <span className="text-xs text-ink-faint font-mono shrink-0">
              {format(new Date(a.created_at), "d MMM, HH:mm", { locale: dateLocale })}
            </span>
          </div>
          <p className="text-sm text-ink-muted whitespace-pre-wrap leading-relaxed lg:text-base">{a.content}</p>
          <p className="text-xs text-command mt-3 font-mono">
            — {a.admin?.display_name} · {a.admin?.admin_role}
          </p>
        </article>
      ))}
    </div>
  );
}
