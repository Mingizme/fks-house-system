import { cn } from "@/lib/utils";

const RING_COLOR: Record<string, string> = {
  wolves: "#4FA8E0",
  phoenix: "#FF5C39",
  lions: "#E8B23F",
  rhinos: "#98A2B3",
};

const BG_CLASS: Record<string, string> = {
  wolves: "bg-house-wolves/15 text-house-wolves",
  phoenix: "bg-house-phoenix/15 text-house-phoenix",
  lions: "bg-house-lions/15 text-house-lions",
  rhinos: "bg-house-rhinos/15 text-house-rhinos",
};

export function HouseCrest({
  color,
  icon,
  size = "md",
  spin = false,
}: {
  color: string;
  icon: string;
  size?: "sm" | "md" | "lg";
  spin?: boolean;
}) {
  const dims = size === "sm" ? "w-9 h-9 text-base" : size === "lg" ? "w-20 h-20 text-4xl" : "w-12 h-12 text-xl";
  const ringPad = size === "sm" ? "p-[2px]" : size === "lg" ? "p-1" : "p-[3px]";

  return (
    <div
      className={cn("rounded-full crest-ring", ringPad, dims, spin && "animate-ring")}
      style={{ ["--ring-color" as string]: RING_COLOR[color] ?? "#6C7BFF" }}
    >
      <div
        className={cn(
          "w-full h-full rounded-full flex items-center justify-center font-display",
          BG_CLASS[color] ?? "bg-command/15 text-command"
        )}
      >
        {icon}
      </div>
    </div>
  );
}

export function HouseBadgeLabel({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full", className)} style={{ backgroundColor: RING_COLOR[color] }} />;
}

export { RING_COLOR };
