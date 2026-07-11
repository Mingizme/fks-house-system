"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HouseCrest } from "./HouseCrest";
import { HousePoints } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/I18nProvider";

const BAR_CLASS: Record<string, string> = {
  wolves: "bg-house-wolves",
  phoenix: "bg-house-phoenix",
  lions: "bg-house-lions",
  rhinos: "bg-house-rhinos",
};

export function HousePointsBoard({
  initial,
  linkPrefix = "/house",
  hiddenHouseIds = [],
}: {
  initial: HousePoints[];
  linkPrefix?: string;
  hiddenHouseIds?: string[];
}) {
  const [houses, setHouses] = useState<HousePoints[]>(initial);
  const supabase = createClient();
  const { t } = useI18n();
  const hiddenSet = useMemo(() => new Set(hiddenHouseIds), [hiddenHouseIds]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-points")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "point_transactions" },
        (payload) => {
          const row = payload.new as { house_id: string; points: number };
          setHouses((prev) =>
            prev.map((h) =>
              h.house_id === row.house_id
                ? { ...h, total_points: pointsValue(h.total_points) + row.points }
                : h
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const sorted = useMemo(
    () =>
      [...houses].sort((a, b) => {
        const aHidden = isScoreHidden(a, hiddenSet);
        const bHidden = isScoreHidden(b, hiddenSet);
        if (aHidden !== bHidden) return aHidden ? 1 : -1;
        if (aHidden && bHidden) return a.name.localeCompare(b.name);
        return pointsValue(b.total_points) - pointsValue(a.total_points);
      }),
    [houses, hiddenSet]
  );
  const max = useMemo(
    () => Math.max(...sorted.filter((h) => !isScoreHidden(h, hiddenSet)).map((h) => pointsValue(h.total_points)), 1),
    [sorted, hiddenSet]
  );

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
      {sorted.map((h, i) => {
        const hidden = isScoreHidden(h, hiddenSet);
        const points = pointsValue(h.total_points);

        return (
          <Link
            key={h.house_id}
            href={`${linkPrefix}/${h.slug}`}
            className="rounded-xl2 glass-card gradient-border p-5 lg:p-6 hover:-translate-y-1 hover:shadow-glow transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <HouseCrest color={h.color} icon={h.icon} />
                <div>
                  <p className="font-display font-bold lg:text-lg">{h.name}</p>
                  <p className="text-xs text-ink-muted font-mono flex items-center gap-1.5">
                    {i === 0 && !hidden && <span>👑</span>}
                    {t("house.rank", { rank: i + 1 })}
                  </p>
                </div>
              </div>
              <p className="font-mono text-2xl lg:text-3xl font-bold tabular-nums group-hover:text-command transition-colors">
                {hidden ? "•••" : points.toLocaleString()}
              </p>
            </div>
            <div className="h-2 rounded-full bg-ink-surface2 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700 ease-out", hidden ? "bg-ink-border" : BAR_CLASS[h.color])}
                style={{
                  width: `${hidden ? 4 : Math.max(4, (points / max) * 100)}%`,
                  boxShadow: hidden ? undefined : "0 0 12px 0 currentColor",
                }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function pointsValue(value: HousePoints["total_points"]) {
  if (typeof value === "number") return value;
  return Number(value ?? 0);
}

function isScoreHidden(house: HousePoints, hiddenHouseIds: Set<string>) {
  return hiddenHouseIds.has(house.house_id) || house.can_view_score === false || house.total_points == null;
}
