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
        setItems((prev) => [{
          ...row,
          admin: admin ?? { id: row.admin_id, display_name: "Admin", admin_role: null },
          house: house ?? undefined,
        }, ...prev]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (items.length === 0) return <p className="text-sm text-ink-muted">{t("points.empty")}</p>;

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border">
      {items.map((tx) => (
        <div key={tx.id} className="p-4 flex items-center gap-3">
          {tx.house && <HouseCrest color={tx.house.color} icon={tx.house.icon} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{tx.house?.name}</span> — {tx.reason}
            </p>
            <p className="text-xs text-ink-faint font-mono">
              {tx.admin?.display_name} ({tx.admin?.admin_role}) · {format(new Date(tx.created_at), "d MMM HH:mm", { locale: dateLocale })}
            </p>
          </div>
          <span className={`font-mono font-bold shrink-0 ${tx.points >= 0 ? "text-success" : "text-danger"}`}>
            {formatPoints(tx.points)}
          </span>
        </div>
      ))}
    </div>
  );
}
