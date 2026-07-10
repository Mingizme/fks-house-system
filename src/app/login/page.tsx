"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import { resolveLoginEmail } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const banned = searchParams.get("banned");
    if (banned === "account") setError(t("auth.accountBanned"));
    if (banned === "ip") setError(t("auth.ipBanned"));
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { email, error: lookupError } = await resolveLoginEmail(supabase, identifier);
    if (lookupError || !email) {
      setError(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    const { data: profileWithBan, error: profileWithBanError } = await supabase
      .from("profiles")
      .select("user_type, account_banned_at")
      .eq("id", data.user.id)
      .single();
    let profile: { user_type: string; account_banned_at: string | null } | null =
      profileWithBan as { user_type: string; account_banned_at: string | null } | null;

    if (profileWithBanError) {
      const { data: legacyProfile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", data.user.id)
        .single();
      profile = legacyProfile ? { user_type: legacyProfile.user_type, account_banned_at: null } : null;
    }

    if (profile?.account_banned_at) {
      await supabase.auth.signOut();
      setError(t("auth.accountBanned"));
      setLoading(false);
      return;
    }

    if (profile?.user_type === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grain relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl">
        <div className="absolute -top-24 left-1/4 w-80 h-80 rounded-full bg-command/30 animate-floatSlow" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-command-cyan/20 animate-floatSlow" style={{ animationDelay: "2s" }} />
      </div>
      <div className="w-full max-w-sm relative z-10 animate-fadeRise">
        <LanguageSwitcher className="mb-5" />
        <Link href="/" className="text-ink-muted text-sm font-mono hover:text-ink-text transition-colors">← {t("common.home")}</Link>
        <div className="glass-card rounded-xl2 p-7 mt-4">
        <h1 className="font-display font-bold text-3xl mb-1">{t("auth.loginPlayerTitle")}</h1>
        <p className="text-ink-muted text-sm mb-8">{t("auth.loginPlayerSubtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("auth.emailOrUsername")}</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-lg bg-ink-surface2/70 border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="ban@example.com / minh_tran"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("common.password")}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-ink-surface2/70 border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-command disabled:opacity-50 font-semibold py-2.5"
          >
            {loading ? t("auth.loggingIn") : t("auth.login")}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm text-command hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <p className="text-sm text-ink-muted mt-6 text-center">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="text-command hover:underline">
            {t("auth.createAccount")}
          </Link>
        </p>
        </div>
      </div>
    </main>
  );
}
