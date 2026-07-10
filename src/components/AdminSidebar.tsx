"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ADMIN_ROLE_LABELS, AdminRole } from "@/lib/types";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";

const NAV = [
  { href: "/admin", labelKey: "nav.overview", icon: "◆", exact: true },
  { href: "/admin/players", labelKey: "nav.playerHouseManage", icon: "👥" },
  { href: "/admin/permissions", labelKey: "nav.permissions", icon: "🔐" },
  { href: "/admin/points", labelKey: "nav.pointsHistory", icon: "📊" },
  { href: "/admin/announcements", labelKey: "nav.announcements", icon: "📣" },
  { href: "/admin/admin-directory", labelKey: "nav.adminDirectory", icon: "🛡️" },
  { href: "/admin/chat", labelKey: "nav.adminGroupChat", icon: "🔒" },
  { href: "/admin/messages", labelKey: "nav.adminMessages", icon: "💬" },
  { href: "/admin/settings", labelKey: "nav.settings", icon: "⚙" },
] satisfies Array<{ href: string; labelKey: TranslationKey; icon: string; exact?: boolean }>;

const HOUSES = [
  { slug: "arctic-wolves", name: "Arctic Wolves", icon: "🐺" },
  { slug: "inferno-phoenix", name: "Inferno Phoenix", icon: "🔥" },
  { slug: "noble-lions", name: "Noble Lions", icon: "🦁" },
  { slug: "ironclad-rhinos", name: "Ironclad Rhinos", icon: "🦏" },
];

export function AdminSidebar({
  displayName,
  adminRole,
  avatarEmoji,
  avatarUrl,
}: {
  displayName: string;
  adminRole: AdminRole | null;
  avatarEmoji: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign-out failed, redirect anyway
    }
    router.push("/admin/login");
  }

  return (
    <aside className="w-64 shrink-0 border-r border-ink-border bg-ink-surface/60 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-ink-border">
        <div className="flex items-center gap-2 font-display font-bold text-sm tracking-[0.18em]">
          <span className="text-gradient">FKS SYSTEM</span>
        </div>
        <span className="text-[10px] font-mono text-ink-faint">{t("common.adminPortal")}</span>
        <LanguageSwitcher className="mt-4" />
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                active ? "bg-command/15 text-command font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]" : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2 hover:translate-x-0.5"
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}

        <p className="text-[10px] font-mono text-ink-faint px-3 pt-5 pb-1">{t("nav.houseMonitor")}</p>
        {HOUSES.map((h) => {
          const active = pathname === `/admin/houses/${h.slug}`;
          return (
            <Link
              key={h.slug}
              href={`/admin/houses/${h.slug}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                active ? "bg-command/15 text-command font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]" : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2 hover:translate-x-0.5"
              )}
            >
              <span className="w-4 text-center">{h.icon}</span>
              {h.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-ink-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            avatarEmoji
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-command font-mono">{adminRole ? ADMIN_ROLE_LABELS[adminRole] : ""}</p>
          <button onClick={signOut} aria-label={t("common.logout")} className="text-xs text-ink-muted hover:text-danger transition-colors">
            {t("common.logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
