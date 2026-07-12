"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ADMIN_ROLE_LABELS, AdminRole } from "@/lib/types";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";

const NAV = [
  { href: "/admin", labelKey: "nav.overview", icon: "◆", exact: true },
  { href: "/admin/players", labelKey: "nav.assignHouses", icon: "🏠", exact: true },
  { href: "/admin/players/moderation", labelKey: "nav.playerModeration", icon: "🚫" },
  { href: "/admin/permissions", labelKey: "nav.permissions", icon: "🔐" },
  { href: "/admin/points", labelKey: "nav.pointsHistory", icon: "📊" },
  { href: "/admin/announcements", labelKey: "nav.announcements", icon: "📣" },
  { href: "/admin/admin-directory", labelKey: "nav.adminDirectory", icon: "🛡️" },
  { href: "/admin/chat", labelKey: "nav.adminGroupChat", icon: "🔒" },
  { href: "/admin/messages", labelKey: "nav.adminMessages", icon: "💬" },
  { href: "/admin/ai-chat", labelKey: "nav.aiChat", icon: "AI" },
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener("open-mobile-nav", open);
    return () => window.removeEventListener("open-mobile-nav", open);
  }, []);

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign-out failed, redirect anyway
    }
    router.push("/admin/login");
  }

  function navActive(item: { href: string; exact?: boolean }) {
    return item.exact ? pathname === item.href : pathname?.startsWith(item.href);
  }

  const navLinks = (onNav?: () => void, variant: "desktop" | "mobile" = "desktop") => {
    const mainLinkClass =
      variant === "desktop"
        ? "flex min-h-12 items-center gap-4 rounded-xl px-4 py-3.5 text-base leading-6 transition-all duration-200"
        : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200";
    const houseLinkClass =
      variant === "desktop"
        ? "flex min-h-11 items-center gap-4 rounded-xl px-4 py-3 text-base leading-6 transition-all duration-200"
        : "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200";
    const iconClass = variant === "desktop" ? "w-6 text-center text-lg" : "w-4 text-center";
    const sectionClass =
      variant === "desktop"
        ? "px-4 pt-6 pb-1.5 text-xs font-mono text-ink-faint"
        : "px-3 pt-5 pb-1 text-[10px] font-mono text-ink-faint";

    return (
      <>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNav}
          className={cn(
            mainLinkClass,
            navActive(item)
              ? "bg-command/15 text-command font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]"
              : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2 hover:translate-x-0.5"
          )}
        >
          <span className={iconClass}>{item.icon}</span>
          {t(item.labelKey)}
        </Link>
      ))}

      <p className={sectionClass}>{t("nav.houseMonitor")}</p>
      {HOUSES.map((h) => {
        const active = pathname === `/admin/houses/${h.slug}`;
        return (
          <Link
            key={h.slug}
            href={`/admin/houses/${h.slug}`}
            onClick={onNav}
            className={cn(
              houseLinkClass,
              active ? "bg-command/15 text-command font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]" : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2 hover:translate-x-0.5"
            )}
          >
            <span className={iconClass}>{h.icon}</span>
            {h.name}
          </Link>
        );
      })}
      </>
    );
  };

  return (
    <>
      {/* ===== Desktop sidebar (giữ nguyên) ===== */}
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-ink-border bg-ink-surface/60 flex-col h-screen sticky top-0 z-40">
        <div className="p-5 border-b border-ink-border">
          <div className="flex items-center gap-2 font-display font-bold text-sm tracking-[0.18em]">
            <span className="text-gradient">FKS SYSTEM</span>
          </div>
          <span className="text-[10px] font-mono text-ink-faint">{t("common.adminPortal")}</span>
          <LanguageSwitcher className="mt-4" />
        </div>

        <nav className="flex-1 space-y-2 px-4 pt-4 overflow-y-auto" aria-label="Admin navigation">
          {navLinks()}
        </nav>

        <div className="p-4 border-t border-ink-border flex items-center gap-3">
          <Avatar avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-command font-mono">{adminRole ? ADMIN_ROLE_LABELS[adminRole] : ""}</p>
            <button onClick={signOut} aria-label={t("common.logout")} className="text-xs text-ink-muted hover:text-danger transition-colors">
              {t("common.logout")}
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Mobile top bar ===== */}
      <div className="mobile-app-topbar lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-ink-border bg-ink-surface/95 backdrop-blur px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-sm tracking-[0.18em] text-gradient">FKS SYSTEM</span>
          <span className="text-[9px] font-mono text-ink-faint">{t("common.adminPortal")}</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t("nav.menu")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-ink-muted hover:bg-ink-surface2 hover:text-ink-text"
        >
          ☰
        </button>
      </div>

      {/* ===== Mobile slide-down menu ===== */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 top-0 max-h-[88vh] overflow-y-auto border-b border-ink-border bg-ink-surface shadow-2xl animate-fadeRise">
            <div className="flex items-center justify-between p-4 border-b border-ink-border">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-sm tracking-[0.18em] text-gradient">FKS SYSTEM</span>
                <span className="text-[9px] font-mono text-ink-faint">{t("common.adminPortal")}</span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t("common.back")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-ink-muted hover:bg-ink-surface2 hover:text-ink-text"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <LanguageSwitcher />
            </div>

            <nav className="p-3 space-y-1" aria-label="Admin navigation">
              {navLinks(() => setMenuOpen(false), "mobile")}
            </nav>

            <div className="p-4 border-t border-ink-border flex items-center gap-3">
              <Avatar avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-command font-mono">{adminRole ? ADMIN_ROLE_LABELS[adminRole] : ""}</p>
              </div>
              <button
                onClick={signOut}
                className="text-sm px-3 py-1.5 rounded-lg border border-ink-border text-ink-muted hover:text-danger hover:border-danger/40 transition-colors"
              >
                {t("common.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ avatarUrl, avatarEmoji }: { avatarUrl: string | null; avatarEmoji: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-ink-surface2 flex items-center justify-center text-lg overflow-hidden shrink-0">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        avatarEmoji
      )}
    </div>
  );
}
