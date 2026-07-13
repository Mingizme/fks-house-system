-- Cách tạo tài khoản ADMIN đầu tiên:
-- 1. Vào trang /signup của web, đăng ký 1 tài khoản bình thường (email + mật khẩu + username).
-- 2. Vào Supabase Dashboard > SQL Editor, chạy câu lệnh dưới đây
--    (thay 'email_can_ban_muon_nang_cap@example.com' và role mong muốn):

update profiles
set user_type = 'admin',
    admin_role = 'director'  -- có thể đổi thành: director | admin | financial | judge | security | linguistic
where id = (select id from auth.users where email = 'email_can_ban_muon_nang_cap@example.com');

-- Sau khi chạy xong, đăng xuất và đăng nhập lại tại /admin/login bằng tài khoản đó.
