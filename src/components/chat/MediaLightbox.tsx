"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lightbox xem ảnh/video trong chat.
 * - Mở giữa màn hình theo kích thước gốc (cap lại theo viewport để không tràn).
 * - Bấm vào ảnh/video: phóng to x2; bấm lần nữa: về như cũ.
 * - Nền xung quanh đen mờ (bg-black/70) để media nổi bật.
 * - Bấm ra ngoài hoặc nhấn Esc để đóng.
 */
interface MediaLightboxProps {
  url: string;
  type: "image" | "video";
  alt?: string;
  onClose: () => void;
}

export default function MediaLightbox({ url, type, alt, onClose }: MediaLightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const zoomClass = zoomed ? "scale-[2] cursor-zoom-out" : "scale-100 cursor-zoom-in";
  const sizeStyle = { maxWidth: "92vw", maxHeight: "92vh" } as const;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/70 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-2xl leading-none text-white/90 transition-colors hover:bg-black/70"
      >
        ×
      </button>

      {type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ""}
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
          }}
          style={sizeStyle}
          className={`select-none rounded-lg shadow-2xl transition-transform duration-200 ${zoomClass}`}
        />
      ) : (
        <video
          src={url}
          controls
          autoPlay
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
          }}
          style={sizeStyle}
          className={`rounded-lg shadow-2xl transition-transform duration-200 ${zoomClass}`}
        />
      )}
    </div>,
    document.body
  );
}
