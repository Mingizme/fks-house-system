"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(t("auth.resetPasswordFailed"));
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grain">
      <div className="w-full max-w-sm">
        <LanguageSwitcher className="mb-5" />
        <h1 className="font-display font-bold text-3xl mt-4 mb-1">{t("auth.resetPasswordTitle")}</h1>
        <p className="text-ink-muted text-sm mb-8">{t("auth.resetPasswordSubtitle")}</p>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-xl2 border border-success/30 bg-success/10 p-4 text-sm text-success">
              {t("auth.passwordUpdated")}
            </div>
            <div className="flex gap-3">
              <Link href="/login" className="text-sm text-command hover:underline">
                {t("auth.loginPlayerTitle")}
              </Link>
              <Link href="/admin/login" className="text-sm text-command hover:underline">
                {t("auth.loginAdminTitle")}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("auth.newPassword")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
                placeholder={t("auth.passwordPlaceholder")}
              />
            </div>

            <div>
              <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("auth.confirmPassword")}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
                placeholder={t("auth.passwordPlaceholder")}
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
              {loading ? t("common.saving") : t("auth.updatePassword")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
