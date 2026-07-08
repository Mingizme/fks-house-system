-- =========================================================
-- MAKE ADMIN v2 — RBAC (Departments + Rank)
-- Chạy trong Supabase Dashboard > SQL Editor
-- Thay <EMAIL> và chọn 1 tổ hợp (department_key, rank) từ bảng bên dưới.
-- An toàn khi chạy lại nhiều lần.
-- =========================================================

-- BẢNG THAM CHIẾU (KHÔNG chạy dòng này, chỉ để xem):
-- ┌───────────────┬──────────────────┐
-- │ department_key│ rank             │
-- ├───────────────┼──────────────────┤
-- │ executive     │ global_director  │  ← Cấp tối cao toàn quyền
-- │ admin         │ director         │
-- │ admin         │ member           │
-- │ security      │ director         │
-- │ security      │ member           │
-- │ linguistic    │ director         │
-- │ linguistic    │ member           │
-- │ judge         │ director         │
-- │ judge         │ member           │
-- │ staff         │ director         │
-- │ staff         │ member           │
-- │ media         │ director         │
-- │ media         │ member           │
-- │ ex            │ director         │
-- │ ex            │ member           │
-- └───────────────┴──────────────────┘

-- ============ THAY 3 GIÁ TRỊ DƯỚI ĐÂY RỒI CHẠY ============
-- 1) Email tài khoản player cần nâng cấp (phải đã đăng ký qua /signup):
--   vd: 'minh_tran@example.com'
-- 2) department_key: vd 'security'
-- 3) rank: 'global_director' | 'director' | 'member'

update profiles
set user_type = 'admin',
    department_id = (select id from departments where key = 'security'),  -- ← đổi department_key
    admin_rank    = 'member'                                               -- ← đổi rank
where id = (
  select id from auth.users where email = 'EMAIL_CUA_BAN@example.com'      -- ← đổi email
);

-- Sau khi chạy xong: đăng xuất rồi đăng nhập lại tại /admin/login.
-- Để gỡ admin → player: chạy lệnh sau (đặt lại user_type, xoá dept/rank):
-- update profiles
--   set user_type = 'player', admin_rank = null, department_id = null
-- where id = (select id from auth.users where email = '...');
