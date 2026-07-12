# House System — Command Center

Web quản lý hệ thống 4 House (Arctic Wolves, Inferno Phoenix, Noble Lions, Ironclad Rhinos),
có đăng nhập Admin/Player riêng, phân quyền Admin (Director, Admin, Judge, Security, Linguistic),
quỹ điểm theo thời gian thực, chat nhóm theo house, tin nhắn riêng, chặn người dùng, và thông báo toàn hệ thống.

**Công nghệ:** Next.js 14 (App Router, TypeScript) + Supabase (Postgres + Auth + Realtime) + Tailwind CSS.
Toàn bộ dữ liệu, xác thực và cập nhật thời gian thực chạy qua Supabase — bạn không cần tự dựng server riêng.

---

## 0. Chuẩn bị (5 phút)

Bạn cần tạo 2 tài khoản miễn phí:

1. **Supabase** — [supabase.com](https://supabase.com) → Sign up → New Project
   - Đặt tên project (vd: `house-system`), tạo mật khẩu database (lưu lại), chọn region gần bạn.
   - Đợi ~2 phút để project khởi tạo xong.
2. **Vercel** — [vercel.com](https://vercel.com) → Sign up (nên dùng tài khoản GitHub để tiện deploy sau này).
3. **GitHub** — nếu chưa có, tạo tài khoản tại [github.com](https://github.com).

---

## 1. Thiết lập Database (Supabase)

1. Vào project Supabase vừa tạo → menu bên trái chọn **SQL Editor**.
2. Chạy **lần lượt** các file SQL theo thứ tự sau (mỗi file: copy → dán → Run):
   1. `supabase/schema.sql` — schema gốc, 4 house, RLS, realtime, trigger tạo profile.
   2. `supabase/schema_update.sql` — hardening + bio + admin_messages.
   3. `supabase/house_master.sql` — House Master/Vice Master + House announcements.
   4. `supabase/chat_features.sql` — edit/delete/reply/reactions cho chat.
   5. `supabase/chat_attachments.sql` — ảnh/video trong chat (bucket `attachments`).
   6. `supabase/make_admin.sql` — (chỉ khi cần) sau khi tạo tài khoản, sửa email + role rồi chạy.
   7. `supabase/rbac.sql` — **Dynamic RBAC**: departments (Security/Linguistic/Admin/Staff/Media/Judge/Ex/Executive), admin_rank (`global_director`/`director`/`deputy_director`/`member`), `can_manage_admin()`, RPC `admin_set_role` / `admin_demote_to_player` / `rename_department`.
   8. **`supabase/rbac_ext.sql`** — (MỚI) Mute có thời hạn + tự gỡ, per-role/per-profile title controls, House score visibility (visible/hidden),_master_can_toggle_score flag, cấm đích danh House Master xem điểm, Leaderboard visibility (`public`/`masters_only`), các RPC và RLS liên quan.

   Mọi file đều idempotent (chạy lại không lỗi). Nếu thấy `Success. No rows returned` là đã chạy đúng.
3. Vào **Authentication → Providers**, đảm bảo **Email** đang bật (mặc định đã bật sẵn).
4. Vào **Authentication → URL Configuration**, tạm thời để nguyên — bạn sẽ cập nhật lại ở bước 4 sau khi deploy xong.
5. (Tuỳ chọn) Vào **Authentication → Providers → Email**, nếu muốn bỏ bước xác nhận email khi test nhanh:
   tắt "Confirm email" (không khuyến khích khi chạy thật, chỉ tắt lúc test).

Lấy 2 thông tin sau (dùng ở bước 2), tại **Project Settings → API**:
- `Project URL` → lưu lại làm `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → lưu lại làm `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. Chạy thử trên máy của bạn (khuyến khích trước khi deploy)

Cài [Node.js](https://nodejs.org) bản LTS (>= 18) nếu chưa có.

```bash
cd house-system
npm install
cp .env.example .env.local
```

Mở file `.env.local` vừa tạo, dán `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` lấy ở bước 1.

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.

---

## 3. Tạo tài khoản Admin đầu tiên

Vì lý do bảo mật, admin không tự đăng ký được — chỉ player mới tự tạo tài khoản.

1. Vào `/signup` (hoặc bấm "Tạo tài khoản Player"), đăng ký một tài khoản bình thường bằng email của bạn.
2. Xác nhận email (kiểm tra hộp thư, kể cả mục spam).
3. Vào Supabase Dashboard → **SQL Editor**, mở file `supabase/make_admin.sql` trong project, sửa email cho đúng, chạy lệnh đó.
4. Quay lại web, đăng nhập tại `/admin/login` bằng chính tài khoản đó — bạn đã là Admin (role Director).
5. Từ đây, để tạo thêm admin khác: cho họ `/signup` như player bình thường, rồi bạn (admin cũ) chạy lại
   câu lệnh trong `make_admin.sql` với email của họ, chọn role tương ứng (`director` / `admin` / `judge` / `security` / `linguistic`).

---

## 4. Deploy để ai cũng truy cập được (Vercel)

1. Đẩy code lên GitHub:
   ```bash
   cd house-system
   git init
   git add .
   git commit -m "Init House System"
   git branch -M main
   git remote add origin https://github.com/<ten-ban>/house-system.git
   git push -u origin main
   ```
   (Tạo repo trống trên GitHub trước, lấy URL để thay vào dòng `remote add`.)

2. Vào [vercel.com](https://vercel.com) → **Add New → Project** → chọn repo `house-system` vừa push.
3. Ở phần **Environment Variables**, thêm:
   - `NEXT_PUBLIC_SUPABASE_URL` = (giá trị lấy ở bước 1)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (giá trị lấy ở bước 1)
4. Bấm **Deploy**, đợi 1-2 phút. Xong, bạn sẽ có link dạng `https://house-system-xxxx.vercel.app` —
   **link này ai ở đâu cũng truy cập được**, có HTTPS sẵn.
5. Quay lại Supabase → **Authentication → URL Configuration** → điền:
   - **Site URL**: link Vercel vừa có
   - **Redirect URLs**: thêm chính link đó (và `http://localhost:3000` nếu vẫn muốn test local)

Vậy là xong — web đã sống thật trên internet, có database, auth, và chat realtime.

(Muốn gắn tên miền riêng như `house.tenban.com`: vào Vercel Project → Settings → Domains → làm theo hướng dẫn, mất khoảng 5-10 phút để DNS cập nhật.)

---

## 5. Cấu trúc tính năng đã có

**Player**
- `/signup`, `/login` — tạo tài khoản & đăng nhập riêng cho player
- `/dashboard` — bảng xếp hạng 4 house theo thời gian thực
- `/admin-directory` — **(MỚI)** danh bạ Admin theo từng Department, xem online/offline realtime, bấm vào admin để xem profile + chat riêng
- `/house/[slug]` — trang house: 2 **Tab riêng biệt** (Chat House | Bảng xếp hạng); Chat có giao diện tối giản DM-like, **panel bên phải** hiển thị điểm + danh sách thành viên (sắp xếp Master → Vice → Player) + **presence online/offline realtime**
- `/messages` — nhắn tin riêng 1:1 với bất kỳ player/admin nào, có thể **chặn** người phiền
- `/announcements` — xem thông báo từ admin (realtime)
- `/profile` — đổi tên hiển thị, biểu tượng, bio (chỉ cài đặt cá nhân; quyền hạn tách riêng ở `/permissions` cho admin)

**Admin** (`/admin/login` riêng biệt)
- `/admin` — tổng quan hệ thống, cảnh báo player chưa xếp house
- `/admin/players` — **phân player vào house** tuỳ ý, xem danh sách chưa xếp
- `/admin/permissions` — **(MỚI) Cấu hình Quyền hạn** tách riêng khỏi `/admin/settings`: đổi tên Department & chức danh (Dynamic Role Renaming — chỉ Global Director), bật/tắt hiển thị điểm House, cấm/cho phép House Master toggle, cấm đích danh Master xem điểm, đặt phạm vi Leaderboard (public / masters_only)
- `/admin/admin-directory` — **(MỚI)** danh bạ admin nhà(admin xem admin), realtime presence
- `/admin/houses/[slug]` — **cộng/trừ điểm** house, tham gia chat bất kỳ house, **bổ nhiệm Master/Vice** (một Player chỉ giữ 1 chức vụ), **Mute player có thời hạn** (tự gỡ khi hết hạn), xem roster có presence
- `/admin/points` — lịch sử cộng/trừ điểm toàn hệ thống
- /admin/announcements` — đăng thông báo tới toàn bộ player
- `/admin/chat` — chat riêng giữa các admin, nhắn 1:1, có thể chặn

### Quy tắc phân quyền (RBAC)
- **Departments ngang hàng**: Security · Linguistic · Admin · Staff · Media · Judge · Executive Protection Detail (Ex). Admin thuộc các department này **không được phép quản trị lẫn nhau** (Mute/Demote/Kick).
- **Director of Department** (vd `Director of Security`): quản lý toàn bộ **member nội bộ** department mình + mọi Player.
- **Global Director** (thuộc department `Executive` — cấp tối cao): toàn quyền với tất cả; có **Dynamic Role Renaming** (đổi tên chức danh), phong Player → Admin, đổi role admin bất kỳ.
- **House Master / Vice Master**: một Player chỉ giữ **duy nhất 1 chức vụ** tại một thời điểm (DB có unique index + RPC `set_house_leader` tự gỡ người cũ).
- **Mute có thời hạn**: `mute_user(target, duration_minutes, reason)`; hệ thống lazy unmute khi `muted_until <= now()` (KHÔNG cần cron).
- Điều khiển hiển thị điểm: House Master được bật/tắt điểm với thành viên house khi Admin **chưa cấm**; Admin có thể **cấm đích danh** Master xem điểm; Leaderboard có chế độ `masters_only`.

Mọi điểm số, tin nhắn, thông báo, presence đều **cập nhật thời gian thực** qua Supabase Realtime — không cần tải lại trang.

---

## 6. Các bước tiếp theo bạn có thể cân nhắc

- Thêm avatar ảnh thật thay vì emoji (dùng Supabase Storage).
- Thêm thông báo đẩy (push notification) khi có tin nhắn mới.
- Giới hạn để chỉ admin role `director` mới được thăng cấp admin khác (hiện tại mọi admin đều có quyền như nhau trong hệ thống — nếu cần phân quyền chi tiết hơn giữa Director/Admin/Judge/Security/Linguistic ở từng chức năng cụ thể, cho tôi biết rõ luật phân quyền, tôi sẽ bổ sung).
- Thêm rate-limit chống spam chat.

Nếu gặp lỗi khi làm theo hướng dẫn, gửi ảnh chụp lỗi, tôi sẽ giúp bạn xử lý tiếp.
