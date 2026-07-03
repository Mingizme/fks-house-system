"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export async function resolveLoginEmail(
  supabase: SupabaseClient,
  identifier: string
): Promise<{ email: string | null; error: "invalid_username" | "not_found" | "lookup_failed" | null }> {
  const value = identifier.trim().toLowerCase();

  if (!value) return { email: null, error: "not_found" };
  if (value.includes("@")) return { email: value, error: null };
  if (!USERNAME_PATTERN.test(value)) return { email: null, error: "invalid_username" };

  const { data, error } = await supabase.rpc("get_login_email", { login_identifier: value });

  if (error) return { email: null, error: "lookup_failed" };
  if (!data || typeof data !== "string") return { email: null, error: "not_found" };

  return { email: data, error: null };
}
