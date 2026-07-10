"use client";

import Link from "next/link";
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

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign-out failed, redirect anyway
    }
    router.push("/login");
  }

  return (
    <aside className="w-full shrink-0 border-b border-ink-border bg-ink-surface/95 backdrop-blur lg:w-64 lg:border-b-0 lg:border-r lg:bg-ink-surface/60 flex flex-col lg:h-screen lg:sticky top-0 z-40">
      <div className="p-3 sm:p-4 lg:p-5 border-b border-ink-border">
        <div className="flex items-center gap-2 font-display font-bold text-sm tracking-[0.18em]">
          <span className="text-gradient">FKS SYSTEM</span>
        </div>
        <LanguageSwitcher className="mt-3 lg:mt-4" />
      </div>

      {house ? (
        <Link
          href={`/house/${house.slug}`}
          className="mx-3 my-2 lg:m-4 p-3 rounded-xl2 border border-ink-border bg-ink-surface2/80 flex items-center gap-3 hover:border-command/50 hover:shadow-glow transition-all duration-200"
        >
          <HouseCrest color={house.color} icon={house.icon} size="sm" />
          <div className="min-w-0">
            <p className="text-xs text-ink-muted font-mono">{t("nav.playerHouse")}</p>
            <p className="font-semibold truncate">{house.name}</p>
          </div>
        </Link>
      ) : (
        <div className="mx-3 my-2 lg:m-4 p-3 rounded-xl2 border border-dashed border-ink-border text-xs text-ink-muted">
          {t("nav.unassigned")}
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto px-3 pb-2 lg:block lg:flex-1 lg:space-y-1 lg:overflow-x-visible lg:pb-0" aria-label="Player navigation">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-3 whitespace-nowrap px-3 py-2.5 rounded-lg text-sm transition-all duration-200 lg:shrink",
                active
                  ? "bg-command/15 text-command font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]"
                  : "text-ink-muted hover:text-ink-text hover:bg-ink-surface2 hover:translate-x-0.5"
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 lg:p-4 border-t border-ink-border flex items-center gap-3">
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
          <button onClick={signOut} aria-label={t("common.logout")} className="text-xs text-ink-muted hover:text-danger transition-colors">
            {t("common.logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
