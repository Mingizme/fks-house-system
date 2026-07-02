"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
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
      setError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError("Username chỉ gồm chữ thường, số, dấu _ (3-20 ký tự).");
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
          ? "Email này đã được đăng ký."
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-grain">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">📬</div>
          <h1 className="font-display font-bold text-2xl mb-2">Kiểm tra email của bạn</h1>
          <p className="text-ink-muted text-sm mb-6">
            Chúng tôi đã gửi link xác nhận đến <span className="text-ink-text">{email}</span>. Xác nhận xong,
            bạn có thể đăng nhập ngay — tài khoản sẽ chưa thuộc house nào cho đến khi admin phân bổ.
          </p>
          <Link href="/login" className="text-command hover:underline text-sm">Về trang đăng nhập</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grain py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-ink-muted text-sm font-mono hover:text-ink-text">← Trang chủ</Link>
        <h1 className="font-display font-bold text-3xl mt-4 mb-1">Tạo tài khoản Player</h1>
        <p className="text-ink-muted text-sm mb-8">
          Tài khoản mới sẽ chưa thuộc house nào — admin sẽ phân bổ sau.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">EMAIL</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="ban@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">USERNAME</label>
            <input
              type="text" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="vd: minh_tran"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">TÊN HIỂN THỊ</label>
            <input
              type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="Trần Minh"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">MẬT KHẨU</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold py-2.5"
          >
            {loading ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </form>

        <p className="text-sm text-ink-muted mt-6 text-center">
          Đã có tài khoản?{" "}
          <Link href="/login" className="text-command hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </main>
  );
}
