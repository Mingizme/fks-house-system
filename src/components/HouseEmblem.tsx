import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const EMBLEMS: Record<string, ReactNode> = {
  wolves: <WolfEmblem />,
  phoenix: <PhoenixEmblem />,
  lions: <LionEmblem />,
  rhinos: <RhinoEmblem />,
};

export function HouseEmblem({
  color,
  fallbackIcon,
  className,
}: {
  color: string;
  fallbackIcon?: string;
  className?: string;
}) {
  const emblem = EMBLEMS[color];

  if (!emblem) {
    return (
      <span aria-hidden="true" className={cn("inline-flex items-center justify-center leading-none", className)}>
        {fallbackIcon}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("house-emblem", `house-emblem--${color}`, className)}
    >
      {emblem}
    </svg>
  );
}

function PhoenixEmblem() {
  return (
    <>
      <g className="house-emblem__wing house-emblem__wing--left">
        <path
          className="house-emblem__fill"
          d="M29.2 28.8C20.4 27.7 12.5 22.9 6.7 14c1.5 12.7 8 22.1 19.5 27.4l5.1-6.9-2.1-5.7Z"
        />
        <path className="house-emblem__stroke" d="M29.2 29C20.4 27.8 12.5 23 6.7 14c1.5 12.7 8 22.1 19.5 27.4" />
        <path className="house-emblem__flare" d="M24.8 32.2c-5.9-2.1-10.6-5.8-14-11" />
      </g>
      <g className="house-emblem__wing house-emblem__wing--right">
        <path
          className="house-emblem__fill"
          d="M34.8 28.8c8.8-1.1 16.7-5.9 22.5-14-1.5 12.7-8 22.1-19.5 27.4l-5.1-6.9 2.1-5.7Z"
        />
        <path className="house-emblem__stroke" d="M34.8 29c8.8-1.2 16.7-6 22.5-15-1.5 12.7-8 22.1-19.5 27.4" />
        <path className="house-emblem__flare" d="M39.2 32.2c5.9-2.1 10.6-5.8 14-11" />
      </g>
      <g className="house-emblem__motion">
        <path
          className="house-emblem__fill"
          d="M32 9.2c-4.3 5.5-5 11-2 16.4-3.4 4.1-4.1 9.1-2.2 14.9L32 54l4.2-13.5c1.9-5.8 1.2-10.8-2.2-14.9 3-5.4 2.3-10.9-2-16.4Z"
        />
        <path
          className="house-emblem__stroke"
          d="M32 9.2c-4.3 5.5-5 11-2 16.4-3.4 4.1-4.1 9.1-2.2 14.9L32 54l4.2-13.5c1.9-5.8 1.2-10.8-2.2-14.9 3-5.4 2.3-10.9-2-16.4Z"
        />
        <path className="house-emblem__flare" d="m27.8 40-7.5 13M32 43v12M36.2 40l7.5 13" />
      </g>
      <path
        className="house-emblem__fill house-emblem__accent"
        d="m31.5 18.5 5.2 2.8-4.6 2.2-2.2-2.3 1.6-2.7Z"
      />
    </>
  );
}

function WolfEmblem() {
  return (
    <g className="house-emblem__motion">
      <path
        className="house-emblem__fill"
        d="m15 19.3 8.9 2.4 4.7-7.3 4.7 7.3 9-2.4-2.1 10c4.4 3.3 6.8 8.4 6.1 14.1-.8 7.4-7 12.9-14.4 12.9S18.3 50.8 17.5 43.4c-.7-5.7 1.7-10.8 6-14.1l-2.1-10Z"
      />
      <path
        className="house-emblem__stroke"
        d="M24.7 31.5c1.9-2.2 4.4-3.3 7.3-3.3 3 0 5.4 1.1 7.3 3.3M23.6 41.1c2.4 4.2 5.2 6.3 8.4 6.3s6-2.1 8.4-6.3M27.5 37.6h.1M36.4 37.6h.1M32 39.4l-2 2.2 2 1.2 2-1.2-2-2.2Z"
      />
      <path
        className="house-emblem__flare"
        d="M20.3 25.5 16.1 20l7.8 1.9M43.7 25.5l4.2-5.5-7.8 1.9"
      />
    </g>
  );
}

function LionEmblem() {
  return (
    <g className="house-emblem__motion">
      <path
        className="house-emblem__fill"
        d="M32 10.5c4.1 0 7.9 1.8 10.4 4.8 5.3.9 9.3 5.5 9.3 11.1 0 3.5-1.6 6.7-4.2 8.8.1.7.2 1.5.2 2.2 0 10.2-6.4 17.2-15.7 17.2s-15.7-7-15.7-17.2c0-.8.1-1.5.2-2.2-2.6-2.1-4.2-5.3-4.2-8.8 0-5.6 4-10.2 9.3-11.1 2.5-3 6.3-4.8 10.4-4.8Z"
      />
      <path
        className="house-emblem__stroke"
        d="M23.5 32.1c1.6-3.6 4.4-5.4 8.5-5.4 4.2 0 7 1.8 8.5 5.4M24.8 40.1c2 4.4 4.4 6.6 7.2 6.6 2.9 0 5.3-2.2 7.2-6.6M26.9 35.6h.1M37 35.6h.1M32 37.1l-2.2 2.4 2.2 1.4 2.2-1.4-2.2-2.4Z"
      />
      <path
        className="house-emblem__flare"
        d="M21.4 21.9c3.2-2.5 6.8-3.8 10.6-3.8s7.4 1.3 10.6 3.8M18.4 27.4c-1.9 2.1-2.8 4.7-2.6 7.7M45.6 27.4c1.9 2.1 2.8 4.7 2.6 7.7"
      />
    </g>
  );
}

function RhinoEmblem() {
  return (
    <g className="house-emblem__motion">
      <path
        className="house-emblem__fill"
        d="M15.1 36.5c0-11.6 7.5-20.1 18.4-20.1 6.7 0 12.1 3.1 15.4 8.7l4.5.7-3.4 4.5c.5 1.9.8 4 .8 6.2 0 11.6-7.5 20.1-18.4 20.1-10.2 0-17.3-7.6-17.3-20.1Z"
      />
      <path className="house-emblem__fill" d="m34 15.4 7.7-8.1-1.5 11.2" />
      <path
        className="house-emblem__stroke"
        d="M22.6 34.1c2.5-2.5 5.6-3.7 9.2-3.7 3.3 0 6.2 1 8.6 3.1M23.3 42c2.5 4 5.4 6 8.7 6 3.2 0 6.1-2 8.6-6M27.4 37.2h.1M37.2 37.2h.1M32.4 39.2l-2.3 1.9 2.3 1.2 2.3-1.2-2.3-1.9Z"
      />
      <path
        className="house-emblem__flare"
        d="M16.3 30.2c2.3-5.7 6.1-9.5 11.4-11.5M43.6 21.9c2.8 2.4 4.7 5.4 5.7 9.1"
      />
    </g>
  );
}
