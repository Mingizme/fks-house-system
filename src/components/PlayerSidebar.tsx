"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HouseCrest } from "./HouseCrest";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";

interface Props {
  displayName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  house: { name: string; slug: string; color: string; icon: string } | null;
}

const NAV = [
  { href: "/dashboard", labelKey: "nav.overview", icon: "◆" },
  { href: "/announcements", labelKey: "nav.announcements", icon: "📣" },
  { href: "/house-announcements", labelKey: "nav.houseAnnouncements", icon: "🏰" },
  { href: "/admin-directory", labelKey: "nav.adminDirectory", icon: "🛡️" },
  { href: "/messages", labelKey: "nav.messages", icon: "✉" },
  { href: "/profile", labelKey: "nav.settings", icon: "⚙" },
] satisfies Array<{ href: string; labelKey: TranslationKey; icon: string }>;

export function PlayerSidebar({ displayName, avatarEmoji, avatarUrl, house }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  // Đóng menu khi điều hướng
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Cho phép khung chat (MobileChatShell) mở menu khi vuốt phải mà không có back
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
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <>
      {/* ===== Desktop sidebar (giữ nguyên) ===== */}
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-ink-border bg-ink-surface/60 flex-col h-screen sticky top-0 z-40">
        <div className="p-5 border-b border-ink-border">
          <div className="flex items-center gap-2 font-display font-bold text-sm tracking-[0.18em]">
            <span className="text-gradient">FKS SYSTEM</span>
          </div>
          <LanguageSwitcher className="mt-4" />
        </div>

        {house ? (
          <Link
            href={`/house/${house.slug}`}
            className="m-4 p-3 rounded-xl2 border border-ink-border bg-ink-surface2/80 flex items-center gap-3 hover:border-command/50 hover:shadow-glow transition-all duration-200"
          >
            <HouseCrest color={house.color} icon={house.icon} size="sm" />
            <div className="min-w-0">
              <p className="text-xs text-ink-muted font-mono">{t("nav.playerHouse")}</p>
              <p className="font-semibold truncate">{house.name}</p>
            </div>
          </Link>
        ) : (
          <div className="m-4 p-3 rounded-xl2 border border-dashed border-ink-border text-xs text-ink-muted">
            {t("nav.unassigned")}
          </div>
        )}

        <nav className="flex-1 space-y-2 px-4" aria-label="Player navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 items-center gap-4 rounded-xl px-4 py-3.5 text-base leading-6 transition-all duration-200",
                isActive(item.href)
                  ? "bg-command/15 text-command font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]"
                  : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2 hover:translate-x-0.5"
              )}
            >
              <span className="w-6 text-center text-lg">{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-ink-border flex items-center gap-3">
          <Avatar avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <button onClick={signOut} aria-label={t("common.logout")} className="text-xs text-ink-muted hover:text-danger transition-colors">
              {t("common.logout")}
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Mobile top bar ===== */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-ink-border bg-ink-surface/95 backdrop-blur px-3 py-2.5">
        <span className="font-display font-bold text-sm tracking-[0.18em] text-gradient">FKS SYSTEM</span>
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
              <span className="font-display font-bold text-sm tracking-[0.18em] text-gradient">FKS SYSTEM</span>
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

            {house ? (
              <Link
                href={`/house/${house.slug}`}
                className="mx-4 mb-2 p-3 rounded-xl2 border border-ink-border bg-ink-surface2/80 flex items-center gap-3"
              >
                <HouseCrest color={house.color} icon={house.icon} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted font-mono">{t("nav.playerHouse")}</p>
                  <p className="font-semibold truncate">{house.name}</p>
                </div>
              </Link>
            ) : (
              <div className="mx-4 mb-2 p-3 rounded-xl2 border border-dashed border-ink-border text-xs text-ink-muted">
                {t("nav.unassigned")}
              </div>
            )}

            <nav className="p-3 space-y-1" aria-label="Player navigation">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-command/15 text-command font-semibold"
                      : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2"
                  )}
                >
                  <span className="w-4 text-center">{item.icon}</span>
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-ink-border flex items-center gap-3">
              <Avatar avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{displayName}</p>
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
