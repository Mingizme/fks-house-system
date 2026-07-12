"use client";

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

interface Props {
  title: string;
  subtitle?: string;
  titleContent?: ReactNode;
  /** Nếu có → nút trái là mũi tên quay lại và vuốt phải điều hướng tới đây */
  backHref?: string;
  /** Nội dung góc phải header (vd badge điểm) */
  rightInfo?: ReactNode;
  /** Panel trượt từ phải (danh sách thành viên / info / control admin) */
  drawer?: ReactNode;
  /** Nhãn nút mở drawer (mặc định: "Thông tin") */
  drawerLabel?: string;
  children: ReactNode;
}

const SWIPE_THRESHOLD = 60;

/**
 * Vỏ chat full màn hình cho điện thoại: header gọn (tên + quay lại/menu + điểm),
 * khung chat chiếm trọn màn hình với thanh nhập ghim đáy, và một drawer phải mở
 * bằng cử chỉ vuốt. Chỉ dùng ở mobile; desktop render bố cục riêng.
 */
export function MobileChatShell({
  title,
  subtitle,
  titleContent,
  backHref,
  rightInfo,
  drawer,
  drawerLabel,
  children,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Khoá cuộn trang nền khi shell chiếm màn hình
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function goBackOrMenu() {
    if (backHref) router.push(backHref);
    else window.dispatchEvent(new CustomEvent("open-mobile-nav"));
  }

  function onTouchStart(e: TouchEvent) {
    const tch = e.touches[0];
    touchStart.current = { x: tch.clientX, y: tch.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - start.x;
    const dy = tch.clientY - start.y;
    // chỉ nhận khi ngang trội để không xung đột với cuộn dọc / long-press
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if (dx < 0) {
      // vuốt trái → mở drawer
      if (drawer) setDrawerOpen(true);
    } else {
      // vuốt phải → đóng drawer nếu đang mở, ngược lại quay lại / mở menu
      if (drawerOpen) setDrawerOpen(false);
      else goBackOrMenu();
    }
  }

  return (
    <div className="fixed inset-0 z-[45] flex h-[100dvh] flex-col bg-ink-bg">
      {/* Header */}
      <header className="relative z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-ink-border bg-ink-surface px-3 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={goBackOrMenu}
          aria-label={backHref ? t("common.back") : t("nav.menu")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-ink-muted hover:bg-ink-surface2 hover:text-ink-text"
        >
          {backHref ? "←" : "☰"}
        </button>
        <div className="min-w-0 flex-1">
          {titleContent ?? (
            <>
              <p className="truncate font-semibold leading-tight">{title}</p>
              {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
            </>
          )}
        </div>
        {rightInfo && <div className="shrink-0 text-right">{rightInfo}</div>}
        {drawer && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={drawerLabel ?? t("chat.showInfo")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-ink-muted hover:bg-ink-surface2 hover:text-ink-text"
          >
            ☰
          </button>
        )}
      </header>

      {/* Thân: khung chat + drawer */}
      <div
        className="relative z-0 min-h-0 flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="h-full min-h-0">{children}</div>

        {drawer && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setDrawerOpen(false)}
              className={`absolute inset-0 z-10 bg-black/50 transition-opacity duration-200 ${
                drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
            {/* Drawer */}
            <aside
              className={`absolute inset-y-0 right-0 z-20 flex w-[82%] max-w-sm flex-col bg-ink-surface shadow-2xl transition-transform duration-200 ${
                drawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="min-h-0 flex-1 overflow-y-auto">{drawer}</div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
