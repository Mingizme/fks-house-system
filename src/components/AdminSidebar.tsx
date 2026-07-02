"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ADMIN_ROLE_LABELS, AdminRole } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Tổng quan", icon: "◆", exact: true },
  { href: "/admin/players", label: "Player & House", icon: "👥" },
  { href: "/admin/points", label: "Lịch sử điểm", icon: "📊" },
  { href: "/admin/announcements", label: "Thông báo", icon: "📣" },
  { href: "/admin/chat", label: "Chat Admin", icon: "🔒" },
];

const HOUSES = [
  { slug: "arctic-wolves", name: "Arctic Wolves", icon: "🐺" },
  { slug: "inferno-phoenix", name: "Inferno Phoenix", icon: "🔥" },
  { slug: "noble-lions", name: "Noble Lions", icon: "🦁" },
  { slug: "ironclad-rhinos", name: "Ironclad Rhinos", icon: "🦏" },
];

export function AdminSidebar({ displayName, adminRole }: { displayName: string; adminRole: AdminRole | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-ink-border bg-ink-surface/60 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-ink-border">
        <div className="flex items-center gap-2 text-command font-display font-bold text-sm tracking-wide">
          HOUSE SYSTEM
        </div>
        <span className="text-[10px] font-mono text-ink-faint">CỔNG QUẢN TRỊ</span>
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active ? "bg-command/15 text-command font-semibold" : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2"
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <p className="text-[10px] font-mono text-ink-faint px-3 pt-5 pb-1">GIÁM SÁT CÁC HOUSE</p>
        {HOUSES.map((h) => {
          const active = pathname === `/admin/houses/${h.slug}`;
          return (
            <Link
              key={h.slug}
              href={`/admin/houses/${h.slug}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active ? "bg-command/15 text-command font-semibold" : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2"
              )}
            >
              <span className="w-4 text-center">{h.icon}</span>
              {h.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-ink-border">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-command font-mono mb-2">{adminRole ? ADMIN_ROLE_LABELS[adminRole] : ""}</p>
        <button onClick={signOut} className="text-xs text-ink-muted hover:text-danger transition-colors">
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
