import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function formatPoints(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US")}`;
}

export const HOUSE_COLOR_KEY: Record<string, string> = {
  wolves: "wolves",
  phoenix: "phoenix",
  lions: "lions",
  rhinos: "rhinos",
};
