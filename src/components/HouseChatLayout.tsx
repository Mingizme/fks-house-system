"use client";

import { useCallback, useState } from "react";
import { HouseChatBox } from "@/components/HouseChatBox";
import { HouseChatSidePanel, HouseChatMember } from "@/components/HouseChatSidePanel";
import { useMuteStatus, MuteBanner } from "@/components/MuteControls";
import type { HouseMessage } from "@/lib/types";

interface Props {
  houseId: string;
  currentUserId: string;
  currentDisplayName: string;
  currentAvatarEmoji: string | null;
  initialMessages: HouseMessage[];
  roster: HouseChatMember[];
  profileBasePath: string;
  messagesBasePath: string;
  canModerate?: boolean;
  canModerateMembers?: boolean;
  activeIpBans?: Array<{ ip_address: string; reason: string | null; created_at: string }>;
  editableName: string;
}

/**
 * Bố cục "DM-like" cho House chat:
 *  - Khung chat tối giản bên trái (gần như DirectChatBox)
 *  - Panel bên phải: danh sách thành viên (sắp xếp Master -> Vice -> Player)
 *  - Hiển thị presence & mute banner
 */
export function HouseChatLayout({
  houseId,
  currentUserId,
  currentDisplayName,
  currentAvatarEmoji,
  initialMessages,
  roster,
  profileBasePath,
  messagesBasePath,
  canModerate,
  canModerateMembers,
  activeIpBans,
  editableName,
}: Props) {
  const maxWords = editableName === "admin" ? 2000 : 1000;
  const { isMuted, muteStatus } = useMuteStatus(currentUserId, houseId);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const refetch = useCallback(() => setVisibilityTick((v) => v + 1), []);
  void visibilityTick;
  void refetch;

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      {/* Chat (DM-like) */}
      <div className="h-[70svh] min-h-[420px] min-w-0 flex-1 xl:h-[calc(100vh-220px)] xl:min-h-[620px]">
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
      <div className="h-[380px] w-full shrink-0 xl:h-[calc(100vh-260px)] xl:min-h-[480px] xl:w-72">
        <HouseChatSidePanel
          houseId={houseId}
          roster={roster}
          messagesBasePath={messagesBasePath}
          profileBasePath={profileBasePath}
          currentUserId={currentUserId}
          canModerateMembers={canModerateMembers}
          activeIpBans={activeIpBans}
        />
      </div>
    </div>
  );
}
