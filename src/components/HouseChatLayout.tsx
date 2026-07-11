"use client";

import { type ReactNode } from "react";
import { HouseChatBox } from "@/components/HouseChatBox";
import { HouseChatSidePanel, HouseChatMember } from "@/components/HouseChatSidePanel";
import { MobileChatShell } from "@/components/MobileChatShell";
import { useIsMobile } from "@/lib/useIsMobile";
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
  /** Tên house — hiển thị ở header mobile */
  houseName: string;
  /** Tổng điểm house — hiển thị góc phải header mobile */
  totalPoints: number;
  /** Viewer có được xem điểm không (ẩn thành ••• nếu không) */
  viewerCanSeeScore: boolean;
  /** Control admin (cộng/trừ điểm + Master/Vice). Desktop: trên khung chat; Mobile: đầu drawer. */
  adminControls?: ReactNode;
}

/**
 * Bố cục House chat:
 *  - Desktop (lg+): chat + side panel cạnh nhau (adminControls phía trên nếu có).
 *  - Mobile: full màn hình qua MobileChatShell; side panel (+ adminControls) trong drawer phải.
 */
export function HouseChatLayout({
  houseId,
  currentUserId,
  initialMessages,
  roster,
  profileBasePath,
  messagesBasePath,
  canModerate,
  canModerateMembers,
  activeIpBans,
  editableName,
  houseName,
  totalPoints,
  viewerCanSeeScore,
  adminControls,
}: Props) {
  const maxWords = editableName === "admin" ? 2000 : 1000;
  const { isMuted, muteStatus } = useMuteStatus(currentUserId, houseId);
  const isMobile = useIsMobile();

  const chatBox = (
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
  );

  const sidePanel = (
    <HouseChatSidePanel
      houseId={houseId}
      roster={roster}
      messagesBasePath={messagesBasePath}
      profileBasePath={profileBasePath}
      currentUserId={currentUserId}
      canModerateMembers={canModerateMembers}
      activeIpBans={activeIpBans}
    />
  );

  if (isMobile) {
    return (
      <MobileChatShell
        title={houseName}
        rightInfo={
          <div className="leading-tight">
            <p className="text-[9px] font-mono uppercase text-ink-muted">{/* điểm */}</p>
            <p className="font-mono text-sm font-bold tabular-nums text-gradient">
              {viewerCanSeeScore ? totalPoints.toLocaleString() : "•••"}
            </p>
          </div>
        }
        drawer={
          <div className="flex h-full flex-col">
            {adminControls && <div className="space-y-4 border-b border-ink-border p-3">{adminControls}</div>}
            <div className="min-h-0 flex-1">{sidePanel}</div>
          </div>
        }
      >
        {chatBox}
      </MobileChatShell>
    );
  }

  // Desktop
  return (
    <div className="flex flex-col gap-4">
      {adminControls}
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="h-[70svh] min-h-[420px] min-w-0 flex-1 xl:h-[calc(100vh-220px)] xl:min-h-[620px]">
          {chatBox}
        </div>
        <div className="h-[380px] w-full shrink-0 xl:h-[calc(100vh-260px)] xl:min-h-[480px] xl:w-72">
          {sidePanel}
        </div>
      </div>
    </div>
  );
}
