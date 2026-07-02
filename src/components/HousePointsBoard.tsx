"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HouseCrest } from "./HouseCrest";
import { HousePoints } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAR_CLASS: Record<string, string> = {
  wolves: "bg-house-wolves",
  phoenix: "bg-house-phoenix",
  lions: "bg-house-lions",
  rhinos: "bg-house-rhinos",
};

export function HousePointsBoard({
  initial,
  linkPrefix = "/house",
}: {
  initial: HousePoints[];
  linkPrefix?: string;
}) {
  const [houses, setHouses] = useState<HousePoints[]>(initial);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-points")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "point_transactions" },
        (payload) => {
          const row = payload.new as { house_id: string; points: number };
          setHouses((prev) =>
            prev
              .map((h) =>
                h.house_id === row.house_id ? { ...h, total_points: h.total_points + row.points } : h
              )
              .sort((a, b) => b.total_points - a.total_points)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...houses].sort((a, b) => b.total_points - a.total_points);
  const max = Math.max(...sorted.map((h) => h.total_points), 1);

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {sorted.map((h, i) => (
        <Link
          key={h.house_id}
          href={`${linkPrefix}/${h.slug}`}
          className="rounded-xl2 border border-ink-border bg-ink-surface p-5 hover:border-ink-faint transition-colors group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <HouseCrest color={h.color} icon={h.icon} />
              <div>
                <p className="font-display font-bold">{h.name}</p>
                <p className="text-xs text-ink-muted font-mono">HẠNG {i + 1}</p>
              </div>
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">{h.total_points.toLocaleString()}</p>
          </div>
          <div className="h-1.5 rounded-full bg-ink-surface2 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", BAR_CLASS[h.color])}
              style={{ width: `${Math.max(4, (h.total_points / max) * 100)}%` }}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
