import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseCrest } from "@/components/HouseCrest";
import { HouseChatBox } from "@/components/HouseChatBox";
import { AddPointsForm } from "@/components/AddPointsForm";
import { formatPoints } from "@/lib/utils";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function AdminHousePage({ params }: { params: { slug: string } }) {
  const { t } = getServerTranslator();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: house } = await supabase.from("houses").select("*").eq("slug", params.slug).single();
  if (!house) notFound();

  const [{ data: points }, { data: roster }, { data: history }, { data: messages }] = await Promise.all([
    supabase.from("house_points").select("total_points").eq("house_id", house.id).single(),
    supabase.from("profiles").select("id, display_name, avatar_emoji").eq("house_id", house.id).order("display_name"),
    supabase
      .from("point_transactions")
      .select("id, points, reason, created_at, admin:profiles(display_name, admin_role)")
      .eq("house_id", house.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("house_messages")
      .select("id, house_id, sender_id, content, created_at, sender:profiles(display_name, avatar_emoji, user_type, admin_role)")
      .eq("house_id", house.id)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <HouseCrest color={house.color} icon={house.icon} size="lg" spin />
        <div>
          <h1 className="font-display font-extrabold text-3xl">{house.name}</h1>
          <p className="text-ink-muted text-sm">{t("house.memberCount", { count: roster?.length ?? 0 })}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-ink-muted font-mono">{t("house.totalPoints")}</p>
          <p className="font-mono text-4xl font-bold">{(points?.total_points ?? 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <AddPointsForm houseId={house.id} adminId={user.id} />
          <div>
            <h2 className="font-display font-bold text-lg mb-3">
              {t("house.groupChat")}{" "}
              <span className="text-xs text-ink-muted font-mono">{t("house.adminChatNote")}</span>
            </h2>
            <HouseChatBox houseId={house.id} currentUserId={user.id} initialMessages={(messages as any) ?? []} />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-3">{t("house.members")}</h2>
            <div className="rounded-xl2 border border-ink-border bg-ink-surface p-2 max-h-56 overflow-y-auto">
              {(roster ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-ink-surface2">
                  <span>{p.avatar_emoji}</span>
                  <span className="text-sm truncate">{p.display_name}</span>
                </div>
              ))}
              {(roster ?? []).length === 0 && <p className="text-sm text-ink-muted p-3">{t("house.noMembers")}</p>}
            </div>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg mb-3">{t("house.pointHistory")}</h2>
            <div className="rounded-xl2 border border-ink-border bg-ink-surface divide-y divide-ink-border max-h-96 overflow-y-auto">
              {(history ?? []).map((tx: any) => (
                <div key={tx.id} className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{tx.reason}</p>
                    <p className="text-xs text-ink-faint font-mono">
                      {t("common.byWithRole", { name: tx.admin?.display_name ?? "", role: tx.admin?.admin_role ?? "" })}
                    </p>
                  </div>
                  <span className={`font-mono text-sm font-bold shrink-0 ${tx.points >= 0 ? "text-success" : "text-danger"}`}>
                    {formatPoints(tx.points)}
                  </span>
                </div>
              ))}
              {(history ?? []).length === 0 && <p className="text-sm text-ink-muted p-3">{t("house.noTransactions")}</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
