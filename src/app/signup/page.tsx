"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError(t("auth.invalidUsername"));
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName || username } },
    });

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? t("auth.emailRegistered")
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-grain">
        <div className="w-full max-w-sm text-center">
          <LanguageSwitcher className="mb-5" />
          <div className="text-4xl mb-4">📬</div>
          <h1 className="font-display font-bold text-2xl mb-2">{t("auth.checkEmailTitle")}</h1>
          <p className="text-ink-muted text-sm mb-6">
            {t("auth.checkEmailBefore")} <span className="text-ink-text">{email}</span>.{" "}
            {t("auth.checkEmailAfter")}
          </p>
          <Link href="/login" className="text-command hover:underline text-sm">{t("auth.backToLogin")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grain py-16">
      <div className="w-full max-w-sm">
        <LanguageSwitcher className="mb-5" />
        <Link href="/" className="text-ink-muted text-sm font-mono hover:text-ink-text">← {t("common.home")}</Link>
        <h1 className="font-display font-bold text-3xl mt-4 mb-1">{t("auth.signupTitle")}</h1>
        <p className="text-ink-muted text-sm mb-8">
          {t("auth.signupSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("common.email")}</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="ban@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("common.username")}</label>
            <input
              type="text" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder={t("auth.usernamePlaceholder")}
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("common.displayName")}</label>
            <input
              type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder={t("auth.displayNamePlaceholder")}
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("common.password")}</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold py-2.5"
          >
            {loading ? t("auth.creating") : t("auth.createAccount")}
          </button>
        </form>

        <p className="text-sm text-ink-muted mt-6 text-center">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="text-command hover:underline">{t("auth.login")}</Link>
        </p>
      </div>
    </main>
  );
}
