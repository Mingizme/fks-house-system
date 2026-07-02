"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PointTransaction } from "@/lib/types";
import { format } from "date-fns";
import { formatPoints } from "@/lib/utils";
import { HouseCrest } from "./HouseCrest";
import { useI18n } from "@/components/I18nProvider";

export function PointsLedger({ initial }: { initial: PointTransaction[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<PointTransaction[]>(initial);
  const { t, dateLocale } = useI18n();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-ledger")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "point_transactions" }, async (payload) => {
        const row = payload.new as PointTransaction;
        const [{ data: admin }, { data: house }] = await Promise.all([
          supabase.from("profiles").select("id, display_name, admin_role").eq("id", row.admin_id).single(),
          supabase.from("houses").select("id, name, slug, color, icon").eq("id", row.house_id).single(),
        ]);
        setItems((prev) => [{ ...row, admin: admin ?? undefined, house: house ?? undefined }, ...prev]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) return <p className="text-sm text-ink-muted">{t("points.empty")}</p>;

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border">
      {items.map((t) => (
        <div key={t.id} className="p-4 flex items-center gap-3">
          {t.house && <HouseCrest color={t.house.color} icon={t.house.icon} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{t.house?.name}</span> — {t.reason}
            </p>
            <p className="text-xs text-ink-faint font-mono">
              {t.admin?.display_name} ({t.admin?.admin_role}) · {format(new Date(t.created_at), "d MMM HH:mm", { locale: dateLocale })}
            </p>
          </div>
          <span className={`font-mono font-bold shrink-0 ${t.points >= 0 ? "text-success" : "text-danger"}`}>
            {formatPoints(t.points)}
          </span>
        </div>
      ))}
    </div>
  );
}
