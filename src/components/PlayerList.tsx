"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";

interface PlayerItem {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  house_id: string | null;
}

interface HouseInfo {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  players: PlayerItem[];
  houses: HouseInfo[];
  basePath: string; // "/messages" or "/admin/messages"
  currentUserId: string;
}

export function PlayerList({ players, houses, basePath, currentUserId }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");

  const houseMap = useMemo(() => {
    const map = new Map<string, HouseInfo>();
    houses.forEach((h) => map.set(h.id, h));
    return map;
  }, [houses]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return players
      .filter((p) => p.id !== currentUserId)
      .filter((p) => !q || p.display_name.toLowerCase().includes(q));
  }, [players, filter, currentUserId]);

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("messages.searchPlayer")}
        aria-label={t("messages.searchPlayer")}
        className="w-full rounded-xl bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors mb-3"
      />
      <div className="grid sm:grid-cols-2 gap-1.5 max-h-[400px] overflow-y-auto">
        {filtered.map((p) => {
          const house = p.house_id ? houseMap.get(p.house_id) : null;
          return (
            <Link
              key={p.id}
              href={`${basePath}/${p.id}`}
              className="flex items-center gap-3 p-3 rounded-xl2 hover:bg-ink-surface border border-transparent hover:border-ink-border transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  p.avatar_emoji ?? "🙂"
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.display_name}</p>
                {house && (
                  <p className="text-xs text-ink-faint truncate">
                    {house.icon} {house.name}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-ink-muted col-span-2 p-3">{t("messages.empty")}</p>
        )}
      </div>
    </div>
  );
}
