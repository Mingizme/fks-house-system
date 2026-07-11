import { formatMessageTimeDivider } from "@/components/chat/timeDividers";

export default function ChatTimeDivider({ timestamp }: { timestamp: string }) {
  const label = formatMessageTimeDivider(timestamp);
  if (!label) return null;

  return (
    <div className="flex items-center justify-center px-4 py-3">
      <span className="rounded-full bg-ink-surface2/80 px-3 py-1 text-[11px] font-medium text-ink-muted">
        {label}
      </span>
    </div>
  );
}
