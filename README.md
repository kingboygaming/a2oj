# A2OJ

Online Judge quy mô lớp / khối chuyên Tin: Next.js App Router, Tailwind, Monaco, KaTeX, Prisma.

## Chạy local

```bash
cd D:\a2clttoj
npm install
npm run db:generate
npm run db:sync:sqlite
npx tsx prisma/seed.ts
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

Tài khoản mẫu:

- Giáo viên: `gv` / `teacher123`
- Học sinh: `hs` / `hs123`

Giao diện hỗ trợ Light, Dark và LGBT; lựa chọn được lưu trên trình duyệt trong menu hình nền và hiệu ứng. Nút theme trên thanh điều hướng chuyển lần lượt giữa ba chế độ.

Mặc định dùng **SQLite** (`prisma/dev.db`) để chạy ngay trên ổ D, không cần PostgreSQL.
Prisma Client được generate tự động sau `npm install`; có thể generate lại bằng `npm run db:generate`.
Các migration trong `prisma/migrations` dành cho PostgreSQL production. Khi cập nhật schema SQLite local, chạy `npm run db:sync:sqlite` thay vì `prisma migrate` để tránh xung đột provider.

## Deploy lên Vercel

Ứng dụng giữ SQLite cho chạy local, còn production trên Vercel dùng Neon PostgreSQL. Cơ sở dữ liệu SQLite local không tự được chuyển lên Neon; trang Vercel bắt đầu với database production riêng.

1. Import repository `kingboygaming/a2oj` tại Vercel và chọn framework **Next.js**.
2. Tạo/kết nối database Neon trong Vercel Marketplace. Tạo database/branch riêng cho Production và Preview để bản thử nghiệm không dùng chung dữ liệu production.
3. Trong **Project → Settings → Environment Variables**, đặt các biến cho từng môi trường:
   - `DATABASE_URL`: URL PostgreSQL thông thường của Neon qua connection pooler (bắt đầu bằng `postgres://` hoặc `postgresql://`).
   - `DIRECT_URL`: URL PostgreSQL trực tiếp của Neon, không qua pooler (cũng bắt đầu bằng `postgres://` hoặc `postgresql://`); Prisma dùng URL này để áp dụng migrations. Không dùng URL Accelerate có dạng `prisma+postgres://`.
   - `SESSION_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự. Có thể tạo bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Lưu cấu hình và deploy nhánh `main`. `vercel.json` dùng lệnh `npm run build:vercel`: tạo Prisma Client PostgreSQL, chạy các migration trong `prisma/migrations`, rồi build Next.js. Nếu thiếu biến môi trường hoặc kết nối DB lỗi, build sẽ báo lỗi thay vì tạo deployment tưởng như thành công.
5. Đăng ký tài khoản trên website. Để cấp quyền quản trị ban đầu, chạy câu lệnh sau trong Neon SQL Editor sau khi thay username bằng tài khoản của bạn:

   ```sql
   UPDATE "User" SET "role" = 'ADMIN' WHERE "username" = 'your_username';
   ```

Các migration production phải được lưu với tên cố định trong `prisma/migrations`; build chỉ chuẩn bị Prisma schema, không tạo migration `init` mới. Nếu deploy báo Prisma `P3009`, hãy xem cột `logs` trong bảng `"_prisma_migrations"` và kiểm tra những bảng đã được tạo trước khi sửa trạng thái migration. Không đánh dấu migration là `rolled back` hoặc `applied` khi chưa xác nhận trạng thái schema, vì migration khởi tạo có thể đã chạy dở.

Không chạy `prisma/seed.ts` trên production vì seed tạo tài khoản mẫu với mật khẩu công khai. Email xác minh chỉ hoạt động sau khi khai báo SMTP và `APP_URL` trong Vercel. Judge mặc định ở mock mode.

## Chess Arena

Trang `/chess` hỗ trợ chơi cục bộ, ghép ngẫu nhiên và phòng công khai với chín nhịp thời gian: Siêu Chớp (1 phút, 1+1, 2+1), Chớp (3 phút, 3+2, 5 phút) và Cờ Chớp (10 phút, 10+5, 15+10). Trận online có thể bật tính Elo; người chơi cần đăng nhập bằng tài khoản học sinh. Máy chủ xác minh nước đi, đồng hồ và kết quả, sau đó cập nhật Elo cùng thống kê. Bảng xếp hạng toàn trường nằm ở `/chess/leaderboard`; ván cục bộ luôn là giao hữu.

Sảnh cờ có nút đấu với Stockfish 19 chạy trong Web Worker trên trình duyệt, với các mức sức mạnh từ dễ đến tối đa. Engine dùng bản lite đơn luồng (~1.9 MB), nên chạy được trên Vercel mà không cần bật COOP/COEP hay `SharedArrayBuffer`; engine chỉ tải trước khi hover/focus nút bot hoặc chọn đấu bot. Worker đã tải được giữ sẵn trong phiên để ván bot bắt đầu nhanh hơn. Sau trận có thể yêu cầu Stockfish phân tích và gợi ý nước đi cho từng lượt; tùy chọn cài đặt cho phép tắt hộp kết quả phủ bàn cờ. Cài đặt premove cũng cho phép xếp nhiều nước trước; từng nước chỉ chạy nếu còn hợp lệ trên bàn cờ thực và có thể hủy toàn bộ hàng đợi. Engine Stockfish.js được phát hành theo GPL-3.0; script `scripts/prepare-stockfish-assets.mjs` tải asset phiên bản 19.0.1 đã ghim, xác minh SHA-256, và kèm giấy phép vào `public/chess-engine` khi chạy `npm run dev`, `npm run build` hoặc `npm run build:vercel`.

Chơi online cần bật Supabase Realtime và cấu hình `NEXT_PUBLIC_SUPABASE_URL` cùng `NEXT_PUBLIC_SUPABASE_ANON_KEY` (hoặc `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) trong môi trường local/Vercel. Phòng dùng Presence/Broadcast nên chỉ tồn tại khi chủ phòng còn kết nối; danh sách phòng không được lưu lâu dài. Khi ván đang diễn ra, phòng công khai có thể được xem ở chế độ khán giả; người chơi cũng có thể chia sẻ liên kết chỉ xem, khán giả được đồng bộ lại lịch sử nước đi khi vào giữa trận. Các trường Elo và dữ liệu trận rated được tạo bởi migration PostgreSQL trong `prisma/migrations`; trên Vercel, build production áp dụng migration như các thay đổi schema khác.

### Đính kèm PDF đề bài

Form tạo/chỉnh sửa bài và form tạo contest hỗ trợ đính kèm PDF tối đa 20 MB; PDF được hiển thị trực tiếp trong trang bài. Tạo bucket Supabase Storage riêng tư tên `problem-statements` (hoặc đặt `SUPABASE_PROBLEM_PDF_BUCKET`), giới hạn dung lượng bucket ở ít nhất 20 MB/file và MIME type `application/pdf`. Cấu hình `SUPABASE_SERVICE_ROLE_KEY` ở server. File được gửi qua API ứng dụng và upload bằng service-role key server-side; không bật public access, không cấp quyền upload cho `anon`, và không đưa service-role key vào biến `NEXT_PUBLIC_*`.

### Bật Live IDE cho website trên Vercel

Vercel không cung cấp Docker daemon để chạy code. Muốn bật Live IDE, cần một máy chủ riêng có Docker và chạy `docker/ide-runner/server.py`; ứng dụng Vercel gọi máy chủ đó qua HTTPS bằng chữ ký HMAC. Không mở cổng Docker hoặc cổng runner trực tiếp ra Internet.

API chạy thử được triển khai bằng Node.js trên Vercel; Docker chỉ chạy trên runner riêng. Khi chưa cấu hình `IDE_RUNNER_URL` và `IDE_RUNNER_SECRET`, API không chuyển sang chạy Docker cục bộ trên Vercel.

Trên máy có Docker, build image runner:

```powershell
docker build -t tinoj-ide-runner:latest -f docker/ide-runner/Dockerfile docker/ide-runner
```

Khởi động dịch vụ trên Windows PowerShell:

```powershell
$env:IDE_RUNNER_SECRET = "<chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự>"
$env:IDE_RUNNER_HOST = "127.0.0.1"
$env:IDE_RUNNER_PORT = "8787"
python docker/ide-runner/server.py
```

Trên Linux:

```sh
export IDE_RUNNER_SECRET="<chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự>"
export IDE_RUNNER_HOST="127.0.0.1"
export IDE_RUNNER_PORT="8787"
python3 docker/ide-runner/server.py
```

Tạo secret bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Dùng cùng một giá trị cho runner và Vercel, không gửi secret vào chat hoặc commit vào Git.

Để thử miễn phí từ máy cá nhân đang bật, cài Cloudflare Tunnel rồi chạy ở cửa sổ terminal khác:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare sẽ hiển thị một URL HTTPS tạm thời. Trong **Vercel → Project → Settings → Environment Variables**, đặt các biến cho **Production**:

- `ENABLE_IDE_DOCKER_RUN` = `true`
- `IDE_RUNNER_URL` = URL HTTPS Cloudflare kết thúc bằng `/run`
- `IDE_RUNNER_SECRET` = cùng secret đã đặt trên máy runner

Redeploy ứng dụng sau khi lưu biến. Tunnel miễn phí kiểu Quick Tunnel chỉ hoạt động khi máy cá nhân và cửa sổ `cloudflared` còn chạy; URL có thể đổi sau khi khởi động lại, khi đó cập nhật `IDE_RUNNER_URL` và redeploy. Với URL ổn định hoặc dịch vụ chạy liên tục, cần domain/tunnel cố định hoặc một VPS. Không bật `ENABLE_IDE_DOCKER_RUN` trên Vercel nếu chưa cấu hình runner URL và secret.

Runner chỉ nhận POST đã ký, từ chối request lặp, giới hạn tối đa 3 lần chạy đồng thời và tiếp tục chạy từng chương trình trong container cô lập, tắt network và giới hạn tài nguyên.

## Contest

Giáo viên có thể chọn bài tập đã xuất bản hoặc tạo bài mới ngay trong form tạo contest. Bài tạo riêng chỉ xuất hiện trong contest đó, không hiển thị ở danh sách bài tập thường. Mỗi contest có các mục **Tổng quan**, **Đề bài** và **Bảng xếp hạng**; trạng thái AC trong contest được tính riêng với bài tập thường.

## Gacha và thẻ sưu tầm

Trang `/gacha` có banner thường và banner giới hạn, tỉ lệ từng thẻ được công khai và phải cộng đúng 100%. Quản trị viên tạo banner/thẻ và ảnh thẻ tại `/admin/gacha`; banner giới hạn có thể đặt thời gian mở. Ảnh JPEG, PNG, WebP hoặc GIF tối đa 3 MB được lưu trong cơ sở dữ liệu.

Người tạo bài tập và contest cấu hình số lượt ngẫu nhiên nhận khi AC/PAC (mặc định AC 5–10, PAC 0–5) và tỉ lệ rơi một thẻ đặc biệt. Thẻ đặc biệt do quản trị viên tạo, không nằm trong banner; PAC chỉ nhận thưởng với bài/contest chấm VNOI và có điểm lớn hơn 0. Mỗi người chỉ nhận một lần PAC và một lần AC cho mỗi bài trong từng contest (hoặc một lần cho bài luyện tập), tránh farm bằng cách nộp lại. Thẻ sưu tầm có thể trưng bày trên hồ sơ công khai.

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

## PostgreSQL local

Để chạy local bằng PostgreSQL thay vì SQLite:

1. Chạy `docker compose up -d`.
2. Đặt `DATABASE_URL="postgresql://oj:oj@localhost:5432/tinoj?schema=public"` và `DIRECT_URL` cùng giá trị trong `.env`.
3. Chạy `npm run db:generate:postgres`.
4. Chạy `npx prisma db push --schema prisma/schema.postgresql.prisma`.
5. Chạy `npx tsx prisma/seed.ts` nếu cần dữ liệu mẫu, sau đó `npm run dev`.

`prisma/schema.prisma` vẫn là schema SQLite mặc định. Schema PostgreSQL được tạo từ đó bằng `scripts/prepare-postgres-schema.mjs`; không sửa tay file sinh ra.
## Judge

- Mặc định `JUDGE_MODE=mock`: không thực thi mã nguồn được nộp lên.
- Trong `.env` local, `JUDGE_MODE=auto` sẽ biên dịch/chạy C++ hoặc Python trên máy phát triển.
- Judge chạy chương trình với từng test case không phải sample trong database và so sánh output chuẩn hóa với đáp án đã lưu.
- Có thể chọn **Interactive** khi tạo/chỉnh sửa bài: interactor C++17 và contestant chạy đồng thời trong Docker runner, giao tiếp qua stdin/stdout. Interactor nhận đường dẫn file input/đáp án qua `argv[1]`/`argv[2]`, đọc output contestant từ stdin, gửi phản hồi qua stdout; mã thoát `0` chấp nhận test, mã khác trả WA. Tối đa 20 test mỗi bài Interactive; FILE I/O không được hỗ trợ.
- Interactive judge cần Docker runner hoạt động (`ENABLE_IDE_DOCKER_RUN="true"`; khi chạy trên Vercel cần `IDE_RUNNER_URL` và `IDE_RUNNER_SECRET`). Judge0/Wandbox không hỗ trợ giao tiếp tương tác. Sau khi cập nhật runner, build lại image theo hướng dẫn bên trên.
- Bộ sinh input có mẫu sẵn cho ma trận/danh sách kề, danh sách cạnh có hướng/vô hướng và trọng số, cây, hoán vị, lưới ký tự; hỗ trợ cả input graph/ma trận tự cấu hình bằng JSON.
- Live IDE có nút chạy thử với input tùy chỉnh hoặc chạy toàn bộ sample (tối đa 20 sample mỗi lượt). Khi bật `ENABLE_IDE_DOCKER_RUN="true"`, endpoint chạy trong Docker runner cô lập; cần đăng nhập, giới hạn 5 lượt/phút mỗi tài khoản, source tối đa 64 KB, input tùy chỉnh tối đa 16 KB và thời gian chạy tối đa 3 giây cho mỗi sample.
- Trong form chỉnh sửa đề, ADMIN hoặc tác giả của đề chưa duyệt có thể sinh tối đa 10 input theo cấu hình JSON ngay trên trình duyệt. Có thể tải ZIP để chạy lời giải thủ công, hoặc tạo output tự động qua cloud: Wandbox, sau đó Judge0 nếu Wandbox không khả dụng; không cần Docker. Các API miễn phí có thể giới hạn hoặc quá tải, và code sẽ được gửi tới dịch vụ cloud được gọi. Ví dụ:

  ```json
  {
    "variables": [
      { "name": "n", "type": "int", "min": 1, "max": 100 },
      { "name": "a", "type": "undirectedGraphMatrix", "size": "n" }
    ],
    "template": "{n}\n{a}\n"
  }
  ```

  Hoặc bấm **Nạp mẫu: đồ thị vô hướng dạng ma trận kề** trong giao diện. Các kiểu biến gồm `int`, `string`, `intArray`, `intMatrix`, `undirectedGraphMatrix`; template quyết định thứ tự và định dạng dòng. Chế độ hỗn hợp sinh test biên min/max trước rồi đến ngẫu nhiên. Kiểu đồ thị bảo đảm ma trận đối xứng và đường chéo chính bằng 0. Mỗi input/output tối đa 24 KB, số test mỗi lượt tối đa 10 và tối đa 3 lần gọi API mỗi phút cho mỗi tài khoản. Kết quả được xem trước trước khi thêm vào bộ test; hãy rà soát test trước khi lưu.
- Trong form tạo/chỉnh sửa contest, giáo viên và quản trị viên cũng có thể dùng công cụ này cho bài mới tạo riêng trong contest. Output tự động hỗ trợ bài dùng stdin/stdout; bài dùng File I/O vẫn có thể sinh input và nhập output thủ công.
- Code nháp trong Live IDE được tự lưu theo tài khoản, đề và ngôn ngữ trên trình duyệt; đổi ngôn ngữ sẽ khôi phục bản nháp riêng, và chỉ dùng code mẫu khi chưa có bản nháp.

`JUDGE_MODE=auto` cho phần chấm bài nộp vẫn chạy trực tiếp trên tiến trình web, không phải sandbox; không dùng chế độ này cho người dùng không đáng tin cậy. Docker runner giúp cô lập Live IDE nhưng không thay thế cập nhật Docker/kernel thường xuyên hoặc bảo vệ tuyệt đối trước lỗ hổng container.

Trong mock mode, có thể kiểm tra giao diện verdict bằng cách thêm một dòng comment vào source code:

```cpp
// OJ-MOCK-VERDICT: AC
```

Thay `AC` bằng `WA`, `CE`, `MLE` hoặc `RE` để mô phỏng trạng thái tương ứng. Với Python, dùng `# OJ-MOCK-VERDICT: WA`. `RE` hiển thị trên giao diện; database vẫn lưu enum `RTE`. Các verdict này chỉ là mô phỏng, không phải kết quả thực thi; MLE thật cần judge worker có giới hạn bộ nhớ.

Trang chi tiết bài nộp hiển thị kết quả từng test đã chạy, số test AC/lỗi/chưa chạy và thời gian mỗi test. Màu AC là xanh; WA/TLE/RE/MLE là đỏ; CE là vàng. Bài nộp cũ không lưu kết quả từng test sẽ hiển thị số test theo cấu hình đề hiện tại và thông báo rằng trạng thái chi tiết không thể khôi phục.

Trang chi tiết mỗi bài tập có danh sách bài nộp gần đây và trang `/problems/{slug}/submissions` để xem toàn bộ, phân trang. Thông tin verdict/điểm là công khai; mã nguồn và kết quả từng test chỉ dành cho chủ bài nộp, giáo viên và quản trị viên.
