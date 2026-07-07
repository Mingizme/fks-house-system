import { clsx, type ClassValue } from "clsx";
import type { HouseRole } from "@/lib/types";

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

/** i18n key for a house leadership role, or null for ordinary members. */
export function houseRoleKey(role: HouseRole | null | undefined): "role.houseMaster" | "role.viceMaster" | null {
  if (role === "master") return "role.houseMaster";
  if (role === "vice") return "role.viceMaster";
  return null;
}
