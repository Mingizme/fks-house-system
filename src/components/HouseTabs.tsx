"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/utils";

type Tab = "chat" | "leaderboard";

interface Props {
  defaultTab?: Tab;
  chatSlot: React.ReactNode;
  leaderboardSlot: React.ReactNode;
  /** Ẩn tab leaderboard nếu player không có quyền xem */
  hideLeaderboard?: boolean;
}

/**
 * 2 Tab hoàn toàn riêng: Chat House | Bảng xếp hạng
 */
export function HouseTabs({ defaultTab = "chat", chatSlot, leaderboardSlot, hideLeaderboard }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(defaultTab);

  if (hideLeaderboard && tab === "leaderboard") {
    // phòng trường hợp khởi tạo sai
    setTab("chat");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-ink-border">
        <TabButton
          active={tab === "chat"}
          onClick={() => setTab("chat")}
          icon="💬"
          label={t("house.groupChat")}
        />
        {!hideLeaderboard && (
          <TabButton
            active={tab === "leaderboard"}
            onClick={() => setTab("leaderboard")}
            icon="📊"
            label={t("dashboard.leaderboard")}
          />
        )}
      </div>

      <div className="flex-1 min-h-0">
        {tab === "chat" ? chatSlot : leaderboardSlot}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 transition-colors text-sm font-medium",
        active
          ? "border-command text-command"
          : "border-transparent text-ink-muted hover:text-ink-text hover:border-ink-border"
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
