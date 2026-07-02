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
2. Mở file `supabase/schema.sql` trong project này, copy toàn bộ nội dung, dán vào SQL Editor, bấm **Run**.
   - File này tạo toàn bộ bảng, 4 house mặc định, bảo mật (Row Level Security), và bật realtime.
   - Nếu thấy dòng `Success. No rows returned` là đã chạy đúng.
3. Vào **Authentication → Providers**, đảm bảo **Email** đang bật (mặc định đã bật sẵn).
4. Vào **Authentication → URL Configuration**, tạm thời để nguyên — bạn sẽ cập nhật lại ở bước 4 sau khi deploy xong.
5. (Tuỳ chọn) Vào **Authentication → Providers → Email**, nếu muốn bỏ bước xác nhận email khi test nhanh:
   tắt "Confirm email" (không khuyến khích khi chạy thật, chỉ tắt lúc test).

Lấy 2 thông tin sau (dùng ở bước 3), tại **Project Settings → API**:
- `Project URL` → đây là `NEXT_PUBLIC_SUPABASE_URL` https://oufgusflshicyopynacj.supabase.co
- `anon public` key → đây là `NEXT_PUBLIC_SUPABASE_ANON_KEY` sb_publishable_up0xji8W1VZAyGw6bskyPg_LxAtMe8k

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
- `/house/[slug]` — trang house của mình: tổng điểm, danh sách thành viên, lịch sử điểm, **chat nhóm house** (realtime, chỉ người cùng house xem/gửi được)
- `/messages` — nhắn tin riêng 1:1 với bất kỳ player nào, có thể **chặn** người phiền
- `/announcements` — xem thông báo từ admin (realtime)
- `/profile` — đổi tên hiển thị, biểu tượng

**Admin** (`/admin/login` riêng biệt)
- `/admin` — tổng quan hệ thống, cảnh báo player chưa xếp house
- `/admin/players` — **phân player vào house** tuỳ ý, xem danh sách chưa xếp
- `/admin/houses/[slug]` — **cộng/trừ điểm cho house** (bắt buộc ghi lý do), xem & **tham gia chat của bất kỳ house nào**
- `/admin/points` — lịch sử cộng/trừ điểm toàn hệ thống, mọi admin đều xem được ai đã cộng gì, khi nào
- `/admin/announcements` — đăng thông báo tới toàn bộ player
- `/admin/chat` — **chat riêng giữa các admin**, nhắn 1:1, có thể chặn

Mọi điểm số, tin nhắn, thông báo đều **cập nhật thời gian thực** qua Supabase Realtime — không cần tải lại trang.

---

## 6. Các bước tiếp theo bạn có thể cân nhắc

- Thêm avatar ảnh thật thay vì emoji (dùng Supabase Storage).
- Thêm thông báo đẩy (push notification) khi có tin nhắn mới.
- Giới hạn để chỉ admin role `director` mới được thăng cấp admin khác (hiện tại mọi admin đều có quyền như nhau trong hệ thống — nếu cần phân quyền chi tiết hơn giữa Director/Admin/Judge/Security/Linguistic ở từng chức năng cụ thể, cho tôi biết rõ luật phân quyền, tôi sẽ bổ sung).
- Thêm rate-limit chống spam chat.

Nếu gặp lỗi khi làm theo hướng dẫn, gửi ảnh chụp lỗi, tôi sẽ giúp bạn xử lý tiếp.
