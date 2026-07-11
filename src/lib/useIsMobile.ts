"use client";

import { useEffect, useState } from "react";

/**
 * Trả về true khi viewport < 1024px (breakpoint `lg`, khớp sidebar).
 * SSR-safe: khởi tạo false, cập nhật sau mount để tránh hydration mismatch.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
