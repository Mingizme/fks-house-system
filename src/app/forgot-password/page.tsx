"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import { resolveLoginEmail } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { email, error: lookupError } = await resolveLoginEmail(supabase, identifier);

    if (!lookupError && email) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grain">
      <div className="w-full max-w-sm">
        <LanguageSwitcher className="mb-5" />
        <Link href="/login" className="text-ink-muted text-sm font-mono hover:text-ink-text">
          ← {t("auth.backToLogin")}
        </Link>

        <h1 className="font-display font-bold text-3xl mt-4 mb-1">{t("auth.forgotPasswordTitle")}</h1>
        <p className="text-ink-muted text-sm mb-8">{t("auth.forgotPasswordSubtitle")}</p>

        {sent ? (
          <div className="rounded-xl2 border border-success/30 bg-success/10 p-4 text-sm text-success">
            {t("auth.resetEmailSent")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("auth.emailOrUsername")}</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
                placeholder="ban@example.com / minh_tran"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold py-2.5"
            >
              {loading ? t("auth.sendingReset") : t("auth.sendResetLink")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
