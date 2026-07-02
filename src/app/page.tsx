import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (profile?.user_type === "admin") redirect("/admin");
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-grain relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30 blur-3xl">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-house-wolves/30" />
        <div className="absolute top-40 right-0 w-96 h-96 rounded-full bg-house-phoenix/30" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-house-lions/20" />
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink-border bg-ink-surface/60 text-xs text-ink-muted font-mono mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulseSoft" /> HỆ THỐNG ĐANG HOẠT ĐỘNG
        </div>
        <h1 className="font-display font-extrabold text-5xl sm:text-6xl tracking-tight mb-4">
          HOUSE <span className="text-command">SYSTEM</span>
        </h1>
        <p className="text-ink-muted text-lg mb-10 leading-relaxed">
          Trung tâm chỉ huy cho bốn ngôi nhà. Điểm số minh bạch, liên lạc thời gian thực,
          mọi quyết định đều được ghi lại.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-command hover:bg-command/85 transition-colors font-semibold"
          >
            Đăng nhập Player
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl border border-ink-border hover:border-command/60 hover:bg-ink-surface transition-colors font-semibold"
          >
            Tạo tài khoản Player
          </Link>
          <Link
            href="/admin/login"
            className="px-6 py-3 rounded-xl border border-ink-border text-ink-muted hover:text-ink-text hover:border-ink-faint transition-colors text-sm font-mono"
          >
            Cổng Admin →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "Arctic Wolves", icon: "🐺", color: "wolves" },
            { name: "Inferno Phoenix", icon: "🔥", color: "phoenix" },
            { name: "Noble Lions", icon: "🦁", color: "lions" },
            { name: "Ironclad Rhinos", icon: "🦏", color: "rhinos" },
          ].map((h) => (
            <div
              key={h.name}
              className="rounded-xl2 border border-ink-border bg-ink-surface/70 py-4 px-2 flex flex-col items-center gap-1"
              style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02)` }}
            >
              <span className="text-2xl">{h.icon}</span>
              <span className="text-xs text-ink-muted font-mono">{h.name}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
