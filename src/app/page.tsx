import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerTranslator } from "@/lib/i18n-server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HouseCrest } from "@/components/HouseCrest";
import Link from "next/link";

export default async function HomePage() {
  const { t } = getServerTranslator();
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
      <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl">
        <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-command/40 animate-floatSlow" />
        <div className="absolute top-32 right-0 w-96 h-96 rounded-full bg-command-cyan/25 animate-floatSlow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-house-phoenix/20 animate-floatSlow" style={{ animationDelay: "3s" }} />
      </div>

      <div className="relative z-10 w-full min-w-0 max-w-2xl text-center animate-fadeRise">
        <LanguageSwitcher className="w-40 mx-auto mb-6" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-ink-border bg-ink-surface/60 text-xs text-ink-muted font-mono mb-8 shadow-crest">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulseSoft shadow-[0_0_10px_2px_rgba(52,211,153,0.6)]" /> {t("home.status")}
        </div>
        <h1 className="font-display font-extrabold text-5xl sm:text-6xl tracking-tight mb-4 leading-[1.05]">
          FUNDING <span className="text-gradient">KINGDOM</span>
        </h1>
        <p className="mb-10 break-words text-lg leading-relaxed text-ink-muted">
          {t("home.tagline")}
        </p>

        <div className="mb-16 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <Link
            href="/login"
            className="w-full rounded-xl bg-command px-7 py-3 font-semibold shadow-crest sm:w-auto"
          >
            {t("home.playerLogin")}
          </Link>
          <Link
            href="/signup"
            className="w-full rounded-xl px-7 py-3 font-semibold btn-ghost sm:w-auto"
          >
            {t("home.playerSignup")}
          </Link>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: "Arctic Wolves", color: "wolves" },
            { name: "Inferno Phoenix", color: "phoenix" },
            { name: "Noble Lions", color: "lions" },
            { name: "Ironclad Rhinos", color: "rhinos" },
          ].map((h) => (
            <div
              key={h.name}
              className="gradient-border glass-card flex min-w-0 flex-col items-center gap-1.5 rounded-xl2 px-2 py-5 transition-transform duration-200 hover:-translate-y-1"
            >
              <HouseCrest color={h.color} />
              <span className="break-words text-[11px] leading-tight text-ink-muted font-mono sm:text-xs">{h.name}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
