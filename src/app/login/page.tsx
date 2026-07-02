"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Email hoặc mật khẩu không đúng.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", data.user.id)
      .single();

    if (profile?.user_type === "admin") {
      await supabase.auth.signOut();
      setError("Tài khoản này là tài khoản Admin. Vui lòng đăng nhập tại Cổng Admin.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grain">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-ink-muted text-sm font-mono hover:text-ink-text">← Trang chủ</Link>
        <h1 className="font-display font-bold text-3xl mt-4 mb-1">Đăng nhập Player</h1>
        <p className="text-ink-muted text-sm mb-8">Vào lãnh địa của house bạn.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="ban@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">MẬT KHẨU</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="••••••••"
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
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="text-sm text-ink-muted mt-6 text-center">
          Chưa có tài khoản?{" "}
          <Link href="/signup" className="text-command hover:underline">
            Tạo tài khoản
          </Link>
        </p>
      </div>
    </main>
  );
}
