• Tôi sẽ áp dụng cùng kiểu cập nhật state local/optimistic cho hai khu vực đó: sau RPC thành công thì UI đổi trạng thái ngay, không phải phụ thuộc hoàn toàn vào router.refresh(). Trước hết tôi đọc đúng hai component đang render House score và Global Leaderboard.

• Called
  └ codegraph.codegraph_explore({"projectPath":"E:\\house-system\\house-system","query":"ScoreVisibilitySection HouseVisibilityRow LeaderboardVisibilitySection admin_set_house_score_visibility admin_set_leaderboard_visibility local state current visibility
        buttons","maxFiles":5})
    ⚠️ Some files referenced below were edited since the last index sync — their codegraph entries may be stale:
      - src/components/rbac/ScoreVisibilitySection.tsx (edited 13ms ago, pending sync)
      - src/components/rbac/LeaderboardVisibilitySection.tsx (edited 11ms ago, pending sync)
      - src/components/AssignHouseSelect.tsx (edited 9ms ago, pending sync)
    **Exploration: ScoreVisibilitySection HouseVisibilityRow LeaderboardVisibilitySection admin_set_house_score_visibility admin_set_leaderboard_visibility local state current visibility buttons**

    Found 24 symbols across 3 files.

    **Blast radius — what depends on these (update/verify before editing)**

    - `LeaderboardVisibilitySection` (src/components/rbac/LeaderboardVisibilitySection.tsx:17) — 1 caller in `src/app/admin/(protected)/permissions/page.tsx`; ⚠️ no covering tests found
    - `ScoreVisibilitySection` (src/components/rbac/ScoreVisibilitySection.tsx:25) — 1 caller in `src/app/admin/(protected)/permissions/page.tsx`; ⚠️ no covering tests found
    - `set` (src/components/rbac/LeaderboardVisibilitySection.tsx:23) — 4 callers in `src/components/rbac/LeaderboardVisibilitySection.tsx`, `src/middleware.ts`, `src/components/AdminGroupChat.tsx`, `src/c...

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• CodeGraph báo hai file này đang pending index sync, nên tôi sẽ đọc trực tiếp đúng file trước khi sửa để tránh dùng snapshot cũ.

• Running Get-Content -LiteralPath .\src\components\rbac\ScoreVisibilitySection.tsx

• Ran Get-Content -LiteralPath .\src\components\rbac\ScoreVisibilitySection.tsx
  └ "use client";

    … +213 lines (ctrl + t to view transcript)
      );
    }

• Ran Get-Content -LiteralPath .\src\components\rbac\LeaderboardVisibilitySection.tsx
  └ "use client";

    … +74 lines (ctrl + t to view transcript)
      );
    }

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• House score đang đọc trực tiếp từ props houses, còn leaderboard đọc trực tiếp từ prop current. Tôi sẽ thêm local state cho cả hai; House row cũng cần callback để cập nhật score_audience và master_can_toggle_score sau RPC thành công.

• Running Get-ChildItem -Path .\supabase -File | Select-String -Pattern 'admin_set_house_score_audience|admin_set_master_score_toggle|admin_unblock_master_score|admin_set_leaderboard_visibility' -Context 2,25

• Ran Get-ChildItem -Path .\supabase -File | Select-String -Pattern 'admin_set_house_score_audience|admin_set_master_score_toggle|admin_unblock_master_score|admin_set_leaderboard_visibility' -Context 2,25
  └
      supabase\rbac_ext.sql:604:
    … +159 lines (ctrl + t to view transcript)



• Ran Select-String -Path .\src\lib\types.ts -Pattern 'export interface House|HouseScoreAudience|HouseMasterToggle' -Context 0,15
  └
    > src\lib\types.ts:25:export type HouseScoreAudience = "house" | "masters_only" | "admin_only";
    … +78 lines (ctrl + t to view transcript)



───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Tôi sẽ cập nhật cả ba trạng thái trong khu House score: select phạm vi xem điểm, nút allow/block House Master toggle, và danh sách Master bị block khi bấm gỡ. Global Leaderboard sẽ đổi active button ngay sau khi RPC thành công.

• Edited src\components\rbac\ScoreVisibilitySection.tsx (+45 -7)
      2
      3 -import { useState } from "react";
      3 +import { useEffect, useState } from "react";
      4  import { useRouter } from "next/navigation";
        ⋮
     28    const { t } = useI18n();
     29 +  const [localHouses, setLocalHouses] = useState<House[]>(houses);
     30 +  const [localBlockedMasters, setLocalBlockedMasters] = useState<BlockRow[]>(blockedMasters);
     31 +
     32 +  useEffect(() => {
     33 +    setLocalHouses(houses);
     34 +  }, [houses]);
     35 +
     36 +  useEffect(() => {
     37 +    setLocalBlockedMasters(blockedMasters);
     38 +  }, [blockedMasters]);
     39 +
     40 +  function updateHouse(nextHouse: House) {
     41 +    setLocalHouses((current) =>
     42 +      current.map((house) => (house.id === nextHouse.id ? nextHouse : house))
     43 +    );
     44 +  }
     45
        ⋮
     62            <tbody>
     47 -            {houses.map((house) => (
     63 +            {localHouses.map((house) => (
     64                <HouseVisibilityRow
        ⋮
     69                  router={router}
     70 +                onHouseChange={updateHouse}
     71                />
        ⋮
     78          <h3 className="text-sm font-semibold">{t("permissions.blockedMasters")}</h3>
     62 -        {blockedMasters.length === 0 ? (
     79 +        {localBlockedMasters.length === 0 ? (
     80            <p className="text-xs text-ink-muted">{t("permissions.noBlockedMasters")}</p>
        ⋮
     82            <ul className="rounded-lg border border-ink-border divide-y divide-ink-border overflow-hidden lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-3 lg:border-0">
     66 -            {blockedMasters.map((block) => (
     83 +            {localBlockedMasters.map((block) => (
     84                <li key={block.master_id} className="p-3 flex items-center gap-3 bg-ink-surface2 lg:rounded-lg lg:border lg:border-ink-border">
        ⋮
     91                  </div>
     75 -                {canAdminBlock && <UnblockMasterButton masterId={block.master_id} supabase={supabase} router={router} />}
     92 +                {canAdminBlock && (
     93 +                  <UnblockMasterButton
     94 +                    masterId={block.master_id}
     95 +                    supabase={supabase}
     96 +                    router={router}
     97 +                    onUnblocked={(masterId) =>
     98 +                      setLocalBlockedMasters((current) => current.filter((row) => row.master_id !== masterId))
     99 +                    }
    100 +                  />
    101 +                )}
    102                </li>
        ⋮
    116 +  onHouseChange: (house: House) => void;
    117  }
    118
     92 -function HouseVisibilityRow({ house, canAdminBlock, supabase, router }: HouseRowProps) {
    119 +function HouseVisibilityRow({ house, canAdminBlock, supabase, router, onHouseChange }: HouseRowProps) {
    120    const { t } = useI18n();
        ⋮
    135      } else {
    136 +      onHouseChange({
    137 +        ...house,
    138 +        score_audience: next,
    139 +        score_visibility: next === "house" ? "visible" : "hidden",
    140 +      });
    141        router.refresh();
        ⋮
    155      } else {
    156 +      onHouseChange({ ...house, master_can_toggle_score: next });
    157        router.refresh();
        ⋮
    223    router,
    224 +  onUnblocked,
    225  }: {
        ⋮
    228    router: ReturnType<typeof useRouter>;
    229 +  onUnblocked: (masterId: string) => void;
    230  }) {
        ⋮
    238      if (error) alert(error.message);
    204 -    else router.refresh();
    239 +    else {
    240 +      onUnblocked(masterId);
    241 +      router.refresh();
    242 +    }
    243    }