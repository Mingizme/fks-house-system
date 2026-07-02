"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HouseCrest } from "./HouseCrest";
import { cn } from "@/lib/utils";

interface Props {
  displayName: string;
  avatarEmoji: string;
  house: { name: string; slug: string; color: string; icon: string } | null;
}

const NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: "◆" },
  { href: "/announcements", label: "Thông báo", icon: "📣" },
  { href: "/messages", label: "Tin nhắn", icon: "✉" },
];

export function PlayerSidebar({ displayName, avatarEmoji, house }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-ink-border bg-ink-surface/60 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-ink-border">
        <div className="flex items-center gap-2 text-command font-display font-bold text-sm tracking-wide">
          HOUSE SYSTEM
        </div>
      </div>

      {house ? (
        <Link
          href={`/house/${house.slug}`}
          className="m-4 p-3 rounded-xl2 border border-ink-border bg-ink-surface2 flex items-center gap-3 hover:border-command/50 transition-colors"
        >
          <HouseCrest color={house.color} icon={house.icon} size="sm" />
          <div className="min-w-0">
            <p className="text-xs text-ink-muted font-mono">HOUSE CỦA BẠN</p>
            <p className="font-semibold truncate">{house.name}</p>
          </div>
        </Link>
      ) : (
        <div className="m-4 p-3 rounded-xl2 border border-dashed border-ink-border text-xs text-ink-muted">
          Bạn chưa được phân vào house nào. Vui lòng chờ admin phân bổ.
        </div>
      )}

      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-command/15 text-command font-semibold"
                  : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2"
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-ink-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg">
          {avatarEmoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <button onClick={signOut} className="text-xs text-ink-muted hover:text-danger transition-colors">
            Đăng xuất
          </button>
        </div>
      </div>
    </aside>
  );
}
