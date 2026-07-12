# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# TỔNG QUAN DỰ ÁN — House System (Command Center)

Web quản lý hệ thống thi đua **4 House** (Arctic Wolves 🐺 · Inferno Phoenix 🔥 · Noble Lions 🦁 · Ironclad Rhinos 🦏): quỹ điểm realtime, chat nhóm theo house, tin nhắn riêng 1:1, chặn người dùng, thông báo toàn hệ thống, phân quyền admin động (Dynamic RBAC), và presence online/offline. Có 2 luồng đăng nhập tách biệt: **Player** và **Admin**.

## Công nghệ & cách chạy
- **Next.js 14** (App Router, TypeScript) + **Supabase** (Postgres + Auth + Realtime + Storage) + **Tailwind CSS**. Không có server backend riêng — mọi logic bảo mật nằm ở Supabase.
- `npm run dev` (cổng 3000). Cần `.env.local` với `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` (xem `.env.example`).
- Đa ngôn ngữ (i18n): vi/en/ja/th/ta/ko, cookie `house_lang`. Xem `src/lib/i18n.ts`, `i18n-server.ts`, `I18nProvider.tsx`.
- Hướng dẫn cài đặt/deploy chi tiết cho người dùng cuối nằm ở `README.md`; yêu cầu gốc của đợt RBAC nằm ở `plan.md`.

## Nguyên tắc kiến trúc QUAN TRỌNG
- **Nguồn chân lý bảo mật là DB**, không phải React. Mọi quyền hạn được enforce bằng **RLS + RPC SECURITY DEFINER** trong Supabase (vd `can_manage_admin()`, `admin_set_role`, `mute_user`, `set_house_leader`). File `src/lib/permissions.ts` chỉ **phản chiếu** logic đó để ẩn/hiện nút trên UI — KHÔNG BAO GIỜ tin lớp này cho bảo mật, luôn giữ nó khớp với SQL tương ứng.
- Middleware (`src/middleware.ts`) chỉ chặn truy cập theo route: redirect chưa đăng nhập, và chặn player vào `/admin/*`. Lưu ý bẫy: `/admin-directory` (của player) KHÁC `/admin/*` (khu admin).
- Supabase clients: `src/lib/supabase/server.ts` (Server Components/Route Handlers, dùng cookies) và `src/lib/supabase/client.ts` (Client Components). Server Components fetch dữ liệu; Client Components lo realtime + tương tác.
- **Realtime**: điểm số, tin nhắn, thông báo, profile đều bật Supabase Realtime — UI cập nhật không cần reload. **Presence** (online/offline) làm hoàn toàn client-side qua `channel.track()` trong `PresenceProvider.tsx` (channel global + channel theo house), không dùng DB heartbeat — tab đóng = offline.

## Cấu trúc thư mục
- `src/app/(player)/*` — khu Player: `dashboard` (leaderboard), `house/[slug]` (2 tab Chat|Ranking + side panel thành viên), `messages`, `announcements`, `house-announcements`, `admin-directory` (xem admin theo department + chat riêng), `profile`.
- `src/app/admin/(protected)/*` — khu Admin: tổng quan, `players` (phân house), `houses/[slug]` (cộng/trừ điểm, bổ nhiệm Master/Vice, mute), `points` (ledger), `announcements`, `permissions` (cấu hình RBAC), `admin-directory`, `chat`, `settings`. Login riêng ở `src/app/admin/login`.
- `src/components/*` — components chia sẻ; `components/chat/*` (ChatInput/ChatMessage/EmojiPicker), `components/rbac/*` (các section cấu hình quyền).
- `src/lib/*` — `types.ts` (toàn bộ model + labels), `permissions.ts`, `i18n*`, `supabase/*`, `utils.ts`, `auth-client.ts`.
- `supabase/*.sql` — migrations idempotent, **chạy theo thứ tự** (xem README §1): `schema.sql` → `schema_update.sql` → `house_master.sql` → `chat_features.sql` → `chat_attachments.sql` → `make_admin.sql`/`make_admin_v2.sql` → `rbac.sql` → `rbac_ext.sql`. Khi đổi model: cập nhật cả SQL migration MỚI (không sửa file cũ đã chạy) và `src/lib/types.ts`.

## Mô hình phân quyền (RBAC) — logic cốt lõi
- **Department** ngang hàng: Security · Linguistic · Admin · Staff · Media · Judge · Executive Protection Detail (Ex). Admin ở các department khác nhau **không quản trị lẫn nhau**.
- **admin_rank**: `member` (quản lý Player) < `deputy_director` (quản lý Player + member cùng department) < `director` (quản lý Player + deputy/member cùng department) < `global_director` (thuộc dept Executive, toàn quyền; có **Dynamic Role Renaming** đổi tên chức danh, phong Player→Admin, đổi role bất kỳ).
- `departmentTitle(rank, dept, override)` trong `types.ts` quyết định chức danh hiển thị (global → "Global Director"; director/deputy/member → title theo department, ưu tiên `role_title_override` từng profile nếu có).
- **House leadership**: một Player chỉ giữ **duy nhất 1 chức** (`master` HOẶC `vice`) — enforce bằng unique index + RPC `set_house_leader` (tự gỡ người cũ).
- **Mute có thời hạn**: `mute_user(target, duration_minutes, reason)`; **lazy unmute** khi `muted_until <= now()`, KHÔNG cần cron.
- **Hiển thị điểm**: House Master bật/tắt điểm cho thành viên house (khi admin chưa cấm); admin có thể cấm Master toggle và/hoặc cấm đích danh Master xem điểm. Leaderboard chung có visibility `public` / `masters_only` / `admin_only`.

## Quy ước khi làm việc
- Admin không tự đăng ký được — chỉ Player `/signup`, rồi promote qua SQL (`make_admin*.sql`). Admin đầu tiên là Global Director.
- Khi thêm/sửa quyền: giữ **3 nơi đồng bộ** — RLS/RPC trong SQL, `permissions.ts`, và UI ẩn/hiện. Mọi migration mới phải idempotent.
- UI/UX: đã tách "Cấu hình Quyền hạn" (`/admin/permissions`) khỏi "Profile" cá nhân; house tách rõ 2 tab Chat vs Leaderboard; chat house theo phong cách DM tối giản + side panel (Master → Vice → Player, kèm presence).
