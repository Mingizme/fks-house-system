"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Presence realtime dùng Supabase channel.track().
 * - Khi Provider mount, track presence của user hiện tại.
 * - Lắng nghe 'presence' events: sync, join, leave để cập nhật danh sách online.
 * - `isOnline(userId)` trả về true nếu user đang có presence trong channel.
 *
 * Lưu ý: presence chỉ tồn tại khi tab còn mở. Trang khác/tab đóng = offline.
 * Đây là trade-off đã chốt: client-side presence, không cần DB heartbeat.
 */

interface PresenceState {
  [userId: string]: {
    id: string;
    display_name?: string;
    avatar_emoji?: string;
    online_at: number;
  };
}

interface PresenceContextValue {
  onlineUserIds: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set(),
  isOnline: () => false,
});

export function usePresence() {
  return useContext(PresenceContext);
}

const CHANNEL_NAME_USER = "presence-global";
const CHANNEL_NAME_HOUSE = "presence-house";

export function PresenceProvider({
  userId,
  displayName,
  avatarEmoji,
  houseId,
  children,
}: {
  userId: string;
  displayName: string;
  avatarEmoji: string | null;
  houseId?: string | null;
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);
  const houseChannelRef = useRef<any>(null);

  const updatePresence = useCallback((state: PresenceState) => {
    const ids = new Set(Object.keys(state));
    setOnlineUserIds(ids);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(CHANNEL_NAME_USER, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as any;
        const flat: PresenceState = {};
        for (const [key, metas] of Object.entries(state)) {
          const meta = Array.isArray(metas) && metas[0] ? (metas[0] as any) : null;
          flat[key] = meta || { id: key, online_at: Date.now() };
        }
        updatePresence(flat);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setOnlineUserIds((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUserIds((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: userId,
            display_name: displayName,
            avatar_emoji: avatarEmoji,
            online_at: Date.now(),
          });
        }
      });

    // House-scoped presence (nếu có houseId): track trên channel house riêng để
    // danh sách thành viên house cập nhật online nhanh và không phụ thuộc channel global
    if (houseId) {
      const houseChannel = supabase.channel(`${CHANNEL_NAME_HOUSE}-${houseId}`, {
        config: { presence: { key: userId } },
      });
      houseChannelRef.current = houseChannel;
      houseChannel
        .on("presence", { event: "sync" }, () => {
          const state = houseChannel.presenceState() as any;
          const flat: PresenceState = {};
          for (const [key, metas] of Object.entries(state)) {
            const meta = Array.isArray(metas) && metas[0] ? (metas[0] as any) : null;
            flat[key] = meta || { id: key, online_at: Date.now() };
          }
          updatePresence(flat);
        })
        .on("presence", { event: "join" }, ({ key }) => {
          setOnlineUserIds((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          setOnlineUserIds((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await houseChannel.track({
              id: userId,
              display_name: displayName,
              avatar_emoji: avatarEmoji,
              online_at: Date.now(),
            });
          }
        });
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        channel.track({
          id: userId,
          display_name: displayName,
          avatar_emoji: avatarEmoji,
          online_at: Date.now(),
        }).catch(() => {});
        houseChannelRef.current?.track({
          id: userId,
          display_name: displayName,
          avatar_emoji: avatarEmoji,
          online_at: Date.now(),
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleBeforeUnload = () => {
      channel.untrack();
      houseChannelRef.current?.untrack();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.untrack();
      houseChannelRef.current?.untrack();
      supabase.removeChannel(channel);
      if (houseChannelRef.current) supabase.removeChannel(houseChannelRef.current);
      houseChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, houseId, displayName, avatarEmoji]);

  const isOnline = useCallback((id: string) => onlineUserIds.has(id), [onlineUserIds]);

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}
