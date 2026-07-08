Tôi đang phát triển một dự án Web Full-stack (Hệ thống quản lý House/Đội nhóm). Hiện tại cấu trúc cơ bản gồm Frontend, Backend, Database (có Real-time chat, xác thực Admin/Player, hệ thống 4 House: Arctic Wolves, Inferno Phoenix, Noble Lions, Ironclad Rhinos) đã hoàn thiện.

Bây giờ, hãy giúp tôi mở rộng hệ thống bằng cách triển khai một cơ chế phân quyền (Dynamic RBAC) phức tạp và tái cấu trúc lại UI/UX theo các yêu cầu chi tiết dưới đây. 

Hãy đọc kỹ toàn bộ dự án (Models, Routes, Controllers, Components) trước khi thực hiện chỉnh sửa mã nguồn.

### 1. CẬP NHẬT CẤU TRÚC DATABASE & PHÂN CẤP QUẢN TRỊ (BACKEND)
Hãy chỉnh sửa Models/Mongoose/Sequelize và Middleware phân quyền theo quy tắc sau:
- Các bộ phận (Department) ngang hàng bao gồm: Security, Linguistic, Admin, Staff, Media, Judge, Executive Protection Detail (viết tắt là Ex).
- Quy tắc ngang hàng: Các Admin thuộc các Department ngang hàng KHÔNG ĐƯỢC phép thực hiện hành động quản trị (Mute, Demote, Kick...) lên nhau.
- Cấp bậc Trưởng bộ phận (Director of Department): Ví dụ 'Director of Security', 'Director of Linguistic'. Họ có quyền quản lý toàn bộ thành viên NỘI BỘ của bộ phận đó (Mute, cấm đăng thông báo, cấm quản lý player, hạ cấp thành viên xuống Player...).
- Cấp bậc Tối cao (Global Director): 
  + Có toàn quyền điều hành tất cả mọi người ở các department khác.
  + Có tính năng "Dynamic Role Renaming": Thay đổi tên hiển thị của các chức danh Admin (Ví dụ: Đổi tên 'Director of Security' thành 'Commanding Chief').
  + Có quyền đổi role của admin bất kỳ hoặc phong một Player lên làm Admin.

### 2. QUYỀN HẠN  & RÀNG BUỘC (BUSINESS LOGIC COSTRAINTS)
- Các bộ phận trong department: Có thêm quyền điều phối House của Player, phong Player làm 'House Master' hoặc 'Vice House Master'.
- Ràng buộc nghiêm ngặt (Constraint): Một Player chỉ được giữ duy nhất 1 chức vụ tại một thời điểm (Hoặc là House Master, hoặc là Vice House Master, không được làm cả hai).
- Hệ thống Mute (Cấm chat): Thêm cơ chế cấm chat có thời hạn (Duration) áp dụng cho Player khi bị Admin phạt. Quá thời gian này hệ thống tự động gỡ phạt (Tích hợp xử lý real-time).

### 3. TÁI CẤU TRÚC UI/UX VÀ PHÂN QUYỀN HIỂN THỊ (FRONTEND)
- Menu Cấu hình: Tách biệt hoàn toàn mục "Cấu hình Quyền hạn" (Permission Settings) ra khỏi mục "Thông tin cá nhân" (Profile Settings). Hãy gom các cài đặt quyền vào một trang/tab riêng.
- Giao diện House: Tách biệt "Bảng xếp hạng" (Leaderboard) và "Khung chat House" thành 2 Tab hoàn toàn riêng biệt.
- Cấu trúc Khung chat House:
  + Giao diện chat thiết kế tối giản giống như giao diện nhắn tin riêng (Direct Message).
  + Bên phải khung chat có một Panel hiển thị Điểm số và Danh sách thành viên trong House.
  + Thứ tự ưu tiên hiển thị trong danh sách từ trên xuống: House Master -> Vice House Master -> Các Player thông thường.
- Tính năng trạng thái (Presence): Hiển thị trạng thái Online/Offline theo thời gian thực (Real-time) của các Player trên danh sách.

### 4. LOGIC BẬT/TẮT HIỂN THỊ ĐIỂM & BẢNG XẾP HẠNG
- Đối với House Master: Có quyền cấu hình Bật/Tắt việc hiển thị Điểm số của House đối với các thành viên trong House của mình.
- Quyền can thiệp của Admin: 
  + Admin có quyền cấm House Master thực hiện quyền Bật/Tắt hiển thị nêu trên.
  + Admin có quyền cấm đích danh House Master xem điểm số của House.
- Đối với Bảng xếp hạng chung: Admin có quyền cấu hình phạm vi hiển thị: "Chỉ cho phép House Master xem", hoặc "Mở công khai cho tất cả mọi Player xem".
Player cũng có 1 mục xem danh sách các admin theo từng department và vai trò, xem admin nào online và offline, khi bấm vào admin nào có khả năng xem thông tin profile admin đó và chat riêng với admin đó để nhận sự trợ giúp

HÃY THỰC HIỆN THEO CÁC BƯỚC:
1. Quét qua cấu trúc thư mục hiện tại và đề xuất kế hoạch chỉnh sửa (Database Migration, API Routes, Frontend Components).
2. Viết mã nguồn và kiểm tra kỹ các điều kiện ràng buộc (Constraints) tránh xung đột logic.