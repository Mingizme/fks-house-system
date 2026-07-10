"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/components/PresenceProvider";
import { PresenceDot } from "@/components/PresenceDot";
import { MemberPopover } from "@/components/MemberPopover";
import { AdminMuteControl } from "@/components/AdminMuteControl";
import { useI18n } from "@/components/I18nProvider";
import { houseRoleKey } from "@/lib/utils";
import type { HouseRole } from "@/lib/types";

export interface HouseChatMember {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  house_role: HouseRole | null;
  username?: string;
  muted_until?: string | null;
  mute_reason?: string | null;
  chat_banned_at?: string | null;
  chat_ban_reason?: string | null;
  account_banned_at?: string | null;
  account_ban_reason?: string | null;
  last_seen_ip?: string | null;
}

interface HouseChatIpBan {
  ip_address: string;
  reason: string | null;
  created_at: string;
}

interface Props {
  houseId: string;
  roster: HouseChatMember[];
  messagesBasePath: string;
  profileBasePath: string;
  currentUserId: string;
  canModerateMembers?: boolean;
  activeIpBans?: HouseChatIpBan[];
}

const ROSTER_SELECT_WITH_MODERATION =
  "id, display_name, avatar_emoji, avatar_url, house_role, username, muted_until, mute_reason, chat_banned_at, chat_ban_reason, account_banned_at, account_ban_reason, last_seen_ip";

function sortRoster(members: HouseChatMember[]): HouseChatMember[] {
  const rank = (r: HouseRole | null) => (r === "master" ? 0 : r === "vice" ? 1 : 2);
  return [...members].sort((a, b) => {
    const ra = rank(a.house_role);
    const rb = rank(b.house_role);
    if (ra !== rb) return ra - rb;
    return a.display_name.localeCompare(b.display_name);
  });
}

export function HouseChatSidePanel({
  houseId,
  roster,
  messagesBasePath,
  profileBasePath,
  currentUserId,
  canModerateMembers,
  activeIpBans = [],
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const { isOnline } = usePresence();
  const [liveRoster, setLiveRoster] = useState<HouseChatMember[]>(roster);

  useEffect(() => {
    setLiveRoster(sortRoster(roster));
  }, [roster]);

  useEffect(() => {
    const channel = supabase
      .channel(`house-roster-${houseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `house_id=eq.${houseId}` },
        () => {
          supabase
            .from("profiles")
            .select(ROSTER_SELECT_WITH_MODERATION)
            .eq("house_id", houseId)
            .order("display_name")
            .then(({ data }) => {
              if (data) setLiveRoster(sortRoster(data as HouseChatMember[]));
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [houseId, supabase]);

  const sortedMembers = sortRoster(liveRoster);
  const onlineCount = sortedMembers.filter((m) => isOnline(m.id)).length;

  return (
    <aside className="flex flex-col rounded-xl2 glass-card overflow-hidden h-full">
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-mono text-ink-muted uppercase tracking-wide">
            {t("house.membersWithCount", { count: sortedMembers.length })}
          </p>
          <span className="flex items-center gap-1 text-[10px] font-mono text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
            {onlineCount} {t("presence.online")}
          </span>
        </div>

        <div className="space-y-0.5">
          {sortedMembers.map((m) => {
            const roleKey = houseRoleKey(m.house_role);
            const online = isOnline(m.id);
            const activeIpBan = m.last_seen_ip
              ? activeIpBans.find((ban) => ban.ip_address === m.last_seen_ip)
              : null;
            return (
              <div key={m.id} className="relative">
                <MemberPopover
                  memberId={m.id}
                  displayName={m.display_name}
                  avatarEmoji={m.avatar_emoji}
                  roleLabel={roleKey ? t(roleKey) : null}
                  messagesBasePath={messagesBasePath}
                  profileBasePath={profileBasePath}
                  currentUserId={currentUserId}
                  extraSlot={
                    canModerateMembers && m.id !== currentUserId ? (
                      <AdminMuteControl
                        targetId={m.id}
                        targetName={m.display_name}
                        targetEmoji={m.avatar_emoji}
                        blocked={null}
                        mutedUntil={m.muted_until}
                        muteReason={m.mute_reason}
                        chatBannedAt={m.chat_banned_at}
                        chatBanReason={m.chat_ban_reason}
                        accountBannedAt={m.account_banned_at}
                        accountBanReason={m.account_ban_reason}
                        lastSeenIp={m.last_seen_ip}
                        ipBannedAt={activeIpBan?.created_at ?? null}
                        ipBanReason={activeIpBan?.reason ?? null}
                        canMute={true}
                        variant="popover"
                      />
                    ) : null
                  }
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <PresenceDot userId={m.id} />
                </div>
                {online && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                  </div>
                )}
              </div>
            );
          })}
          {sortedMembers.length === 0 && (
            <p className="text-sm text-ink-muted p-3">{t("house.noMembers")}</p>
          )}
        </div>
      </div>
    </aside>
  );
}
