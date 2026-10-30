# A2OJ

Online Judge quy mô lớp / khối chuyên Tin: Next.js App Router, Tailwind, Monaco, KaTeX, Prisma.

## Chạy local

```bash
cd D:\a2clttoj
npm install
npm run db:generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

Tài khoản mẫu:

- Giáo viên: `gv` / `teacher123`
- Học sinh: `hs` / `hs123`

Giao diện mặc định dùng nền tối; nút hình mặt trời/mặt trăng trên thanh điều hướng đổi giữa nền tối và sáng, lựa chọn được lưu trên trình duyệt.

Mặc định dùng **SQLite** (`prisma/dev.db`) để chạy ngay trên ổ D, không cần PostgreSQL.
Prisma Client được generate tự động sau `npm install`; có thể generate lại bằng `npm run db:generate`.

## Contest

Giáo viên có thể chọn bài tập đã xuất bản hoặc tạo bài mới ngay trong form tạo contest. Bài tạo riêng chỉ xuất hiện trong contest đó, không hiển thị ở danh sách bài tập thường. Mỗi contest có các mục **Tổng quan**, **Đề bài** và **Bảng xếp hạng**; trạng thái AC trong contest được tính riêng với bài tập thường.

## Hồ sơ và tài khoản

Trang hồ sơ hiển thị thống kê và hoạt động; các mục cài đặt được tách tại `/settings/profile`, `/settings/security` và `/settings/email`. Có thể cập nhật tên hiển thị, ảnh đại diện (JPEG/PNG/WebP, tối đa 2 MB), tiểu sử và trường học. Tiểu sử và trường học hiển thị công khai tại `/users/{username}`; email không được hiển thị công khai. Đổi mật khẩu yêu cầu mật khẩu hiện tại và đăng xuất các phiên khác.

Trang chủ có bảng ACM toàn hệ thống: mỗi người chỉ được tính AC đầu tiên cho mỗi bài; mỗi lần WA/TLE/RE/CE/MLE trước AC cộng 20 phút penalty. Bảng xếp hạng sắp theo số bài AC giảm dần, penalty tăng dần; không cộng thời gian giải vì không có mốc contest chung.

Liên kết email chỉ có hiệu lực sau khi xác minh. Cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` và `APP_URL` trong `.env` trước khi gửi liên kết. Token xác minh chỉ dùng một lần và hết hạn sau 30 phút.

### Cho mọi người test A2OJ cùng mạng LAN / Radmin VPN

Không dùng `npm run dev` để người khác truy cập qua IP VPN; Next.js dev server cần kết nối HMR mà một số mạng VPN không hỗ trợ ổn định, khiến form có thể không hoạt động đúng. Dùng production server:

```powershell
npm run build
docker build -t tinoj-ide-runner:latest -f docker/ide-runner/Dockerfile docker/ide-runner
```

Trong `.env`, bật runner và giữ judge nộp bài ở chế độ mock:

```env
JUDGE_MODE="mock"
ENABLE_IDE_DOCKER_RUN="true"
IDE_RUNNER_IMAGE="tinoj-ide-runner:latest"
```

Nếu A2OJ báo không tìm thấy Docker CLI, chạy `where.exe docker` trong Command Prompt rồi thêm đường dẫn `docker.exe` tìm được vào `.env`, ví dụ:

```env
IDE_DOCKER_COMMAND="C:\Program Files\Docker\Docker\resources\bin\docker.exe"
```

Sau khi sửa `.env`, khởi động lại TinOJ để nhận cấu hình mới.

Sau đó khởi động ứng dụng:

```powershell
npm run start:lan
```

Live IDE sẽ chạy C++/Python trong container tạm thời với network tắt, filesystem gốc chỉ đọc, user không đặc quyền, giới hạn CPU/bộ nhớ/số tiến trình/thời gian. Thư mục `/tmp` riêng của container cho phép chạy binary vừa biên dịch; không mount file hoặc thư mục máy chủ vào runner. Docker Engine phải được cài đặt và đang chạy; tài khoản chạy Next.js cần quyền sử dụng Docker. Mỗi lần chạy tạo container mới và tự xóa khi hoàn tất.

Mọi người truy cập `http://<IP-Radmin-của-máy-chạy-TinOJ>:3000` và cần đăng nhập. Nếu Windows Firewall hỏi, chỉ cho phép Node.js trên mạng Radmin cần thiết. Server và database vẫn nằm trên máy host. Không mở port này trực tiếp ra Internet hoặc mở Docker API ra mạng.

### Cấp quyền quản trị

Không tạo sẵn tài khoản ADMIN hoặc mật khẩu quản trị mặc định. Để cấp quyền cho tài khoản của bạn trong môi trường local:

1. Chạy `npx prisma studio`.
2. Mở bảng `User`, chọn tài khoản cần cấp quyền.
3. Đổi trường `role` thành `ADMIN` và lưu.
4. Đăng nhập lại; menu tài khoản sẽ có mục **Quản trị**.

Tại **Quản lý bài tập**, admin có thể sửa đề, giới hạn và test case; trạng thái xuất bản được giữ nguyên sau khi sửa. Trong form sửa bài, nhập test từ file `.zip` có các cặp cùng tên như `01.in` + `01.out`. File ZIP tối đa 5 MB, mỗi test tối đa 2 MB, tối đa 100 cặp; các test nhập vào được thêm vào danh sách hiện có dưới dạng test ẩn. Kiểm tra danh sách rồi lưu đề. Mục **Đăng tin** tại `/admin/news` cho phép tạo tin Markdown và ghim tin lên trang chủ.

Trong khu quản trị có **Quản lý contest** và **Quản lý tài khoản**. Xóa contest sẽ xóa bài nộp, lượt đăng ký và các bài chỉ thuộc contest đó. Xóa tài khoản sẽ xóa bài nộp, bài và contest do tài khoản tạo, lượt đăng ký và tin tức liên quan; bài của tài khoản được dùng ở contest khác sẽ bị gỡ khỏi contest đó. Thao tác xóa yêu cầu xác nhận, không thể hoàn tác; không thể xóa tài khoản đang đăng nhập hoặc admin cuối cùng.

Trang `/admin` và API duyệt đề đều kiểm tra role ở phía máy chủ. Không cấp role ADMIN cho tài khoản công khai hoặc người dùng không đáng tin cậy.

## PostgreSQL

1. `docker compose up -d`
2. Trong `prisma/schema.prisma` đổi `provider` thành `"postgresql"`
3. `DATABASE_URL="postgresql://oj:oj@localhost:5432/tinoj?schema=public"`
4. `npx prisma db push && npx tsx prisma/seed.ts`

## Judge

- Mặc định `JUDGE_MODE=mock`: không thực thi mã nguồn được nộp lên.
- Trong `.env` local, `JUDGE_MODE=auto` sẽ biên dịch/chạy C++ hoặc Python trên máy phát triển.
- Judge chạy chương trình với từng test case không phải sample trong database và so sánh output chuẩn hóa với đáp án đã lưu.
- Live IDE có nút chạy thử với input tùy chỉnh hoặc chạy toàn bộ sample (tối đa 20 sample mỗi lượt). Khi bật `ENABLE_IDE_DOCKER_RUN="true"`, endpoint chạy trong Docker runner cô lập; cần đăng nhập, giới hạn 5 lượt/phút mỗi tài khoản, source tối đa 64 KB, input tùy chỉnh tối đa 16 KB và thời gian chạy tối đa 3 giây cho mỗi sample.
- Code nháp trong Live IDE được tự lưu theo tài khoản, đề và ngôn ngữ trên trình duyệt; đổi ngôn ngữ sẽ khôi phục bản nháp riêng, và chỉ dùng code mẫu khi chưa có bản nháp.

`JUDGE_MODE=auto` cho phần chấm bài nộp vẫn chạy trực tiếp trên tiến trình web, không phải sandbox; không dùng chế độ này cho người dùng không đáng tin cậy. Docker runner giúp cô lập Live IDE nhưng không thay thế cập nhật Docker/kernel thường xuyên hoặc bảo vệ tuyệt đối trước lỗ hổng container.

Trong mock mode, có thể kiểm tra giao diện verdict bằng cách thêm một dòng comment vào source code:

```cpp
// OJ-MOCK-VERDICT: AC
```

Thay `AC` bằng `WA`, `CE`, `MLE` hoặc `RE` để mô phỏng trạng thái tương ứng. Với Python, dùng `# OJ-MOCK-VERDICT: WA`. `RE` hiển thị trên giao diện; database vẫn lưu enum `RTE`. Các verdict này chỉ là mô phỏng, không phải kết quả thực thi; MLE thật cần judge worker có giới hạn bộ nhớ.

Trang chi tiết bài nộp hiển thị kết quả từng test đã chạy, số test AC/lỗi/chưa chạy và thời gian mỗi test. Màu AC là xanh; WA/TLE/RE/MLE là đỏ; CE là vàng. Bài nộp cũ không lưu kết quả từng test sẽ hiển thị số test theo cấu hình đề hiện tại và thông báo rằng trạng thái chi tiết không thể khôi phục.

Trang chi tiết mỗi bài tập có danh sách bài nộp gần đây và trang `/problems/{slug}/submissions` để xem toàn bộ, phân trang. Thông tin verdict/điểm là công khai; mã nguồn và kết quả từng test chỉ dành cho chủ bài nộp, giáo viên và quản trị viên.
