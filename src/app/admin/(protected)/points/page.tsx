import { createClient } from "@/lib/supabase/server";
import { PointsLedger } from "@/components/PointsLedger";
import { getServerTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Points History — FKS System",
  description: "View and filter point transaction history and ledgers.",
};

export default async function AdminPointsPage() {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const { data: history } = await supabase
    .from("point_transactions")
    .select("id, house_id, admin_id, points, reason, created_at, admin:profiles(id, display_name, admin_role), house:houses(id, name, slug, color, icon)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="p-8 lg:p-10 2xl:p-12 w-full max-w-[1800px] mx-auto animate-fadeRise">
      <header className="mb-6 lg:mb-8">
        <p className="text-ink-muted font-mono text-xs mb-1 lg:text-sm">{t("admin.pointsKicker")}</p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl">{t("admin.pointsTitle")}</h1>
        <p className="text-ink-muted text-sm mt-1">{t("admin.pointsSubtitle")}</p>
      </header>
      <PointsLedger initial={(history as any) ?? []} />
    </main>
  );
}
