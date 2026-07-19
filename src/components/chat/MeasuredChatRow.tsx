"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  rowKey: string;
  onMeasure: (rowKey: string, height: number) => void;
  children: ReactNode;
  className?: string;
}

export default function MeasuredChatRow({ rowKey, onMeasure, children, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => onMeasure(rowKey, element.getBoundingClientRect().height);
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMeasure, rowKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
