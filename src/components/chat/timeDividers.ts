export const MESSAGE_TIME_DIVIDER_GAP_MS = 5 * 60 * 1000;

export function shouldShowMessageTimeDivider(
  timestamp: string,
  previousTimestamp?: string | null,
  gapMs = MESSAGE_TIME_DIVIDER_GAP_MS
) {
  const currentTime = new Date(timestamp).getTime();
  if (!Number.isFinite(currentTime)) return false;
  if (!previousTimestamp) return true;

  const previousTime = new Date(previousTimestamp).getTime();
  if (!Number.isFinite(previousTime)) return true;

  return currentTime - previousTime >= gapMs;
}

export function formatMessageTimeDivider(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat(undefined, {
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
