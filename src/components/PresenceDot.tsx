"use client";

import { usePresence } from "@/components/PresenceProvider";

/**
 * Chấm trạng thái online/offline realtime.
 * Online = xanh; Offline = xám.
 */
export function PresenceDot({
  userId,
  className = "",
  size = "sm",
}: {
  userId: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { isOnline } = usePresence();
  const online = isOnline(userId);
  const dotSize = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={`inline-block ${dotSize} rounded-full border border-ink-surface ${online ? "bg-success" : "bg-ink-faint"} ${className}`}
    />
  );
}
