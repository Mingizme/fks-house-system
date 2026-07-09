"use client";

import { useCallback, useState } from "react";
import { HouseChatBox } from "@/components/HouseChatBox";
import { HouseChatSidePanel, HouseChatMember } from "@/components/HouseChatSidePanel";
import { useMuteStatus, MuteBanner } from "@/components/MuteControls";
import type { HouseMessage, HouseScoreVisibility, HouseMasterToggle } from "@/lib/types";

interface Props {
  houseId: string;
  currentUserId: string;
  currentDisplayName: string;
  currentAvatarEmoji: string | null;
  initialMessages: HouseMessage[];
  totalPoints: number;
  scoreVisibility: HouseScoreVisibility | "visible" | undefined;
  masterCanToggleScore: HouseMasterToggle | "allowed" | undefined;
  viewerCanSeeScore: boolean;
  roster: HouseChatMember[];
  profileBasePath: string;
  messagesBasePath: string;
  canModerate?: boolean;
  editableName: string;
}

/**
 * Bố cục "DM-like" cho House chat:
 *  - Khung chat tối giản bên trái (gần như DirectChatBox)
 *  - Panel bên phải: Điểm + danh sách thành viên (sắp xếp Master -> Vice -> Player)
 *  - Hiển thị presence & mute banner
 */
export function HouseChatLayout({
  houseId,
  currentUserId,
  currentDisplayName,
  currentAvatarEmoji,
  initialMessages,
  totalPoints,
  scoreVisibility,
  masterCanToggleScore,
  viewerCanSeeScore,
  roster,
  profileBasePath,
  messagesBasePath,
  canModerate,
  editableName,
}: Props) {
  const maxWords = editableName === "admin" ? 2000 : 1000;
  const { isMuted, muteStatus } = useMuteStatus(currentUserId, houseId);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const refetch = useCallback(() => setVisibilityTick((v) => v + 1), []);
  void visibilityTick;
  void refetch;

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[620px]">
      {/* Chat (DM-like) */}
      <div className="flex-1 min-w-0">
        <HouseChatBox
          houseId={houseId}
          currentUserId={currentUserId}
          initialMessages={initialMessages}
          profileBasePath={profileBasePath}
          canModerate={canModerate}
          viewerMuted={isMuted}
          muteBanner={<MuteBanner muteStatus={muteStatus} />}
          maxWords={maxWords}
        />
      </div>

      {/* Side panel */}
      <div className="hidden lg:block w-72 shrink-0 h-[calc(100vh-260px)] min-h-[480px]">
        <HouseChatSidePanel
          houseId={houseId}
          totalPoints={totalPoints}
          scoreVisibility={scoreVisibility}
          masterCanToggleScore={masterCanToggleScore}
          viewerCanSeeScore={viewerCanSeeScore}
          roster={roster}
          messagesBasePath={messagesBasePath}
          profileBasePath={profileBasePath}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
