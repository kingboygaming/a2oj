ALTER TABLE "RoadmapStage"
ADD COLUMN "content" TEXT NOT NULL DEFAULT '';

UPDATE "RoadmapStage"
SET "content" = '## Mục tiêu

Chương trình nhận dữ liệu, xử lý theo các bước rõ ràng rồi in kết quả. Hãy bắt đầu bằng C++ hoặc Python và chia yêu cầu của đề thành các bước nhỏ.

## Kiến thức nền tảng

Làm quen với biến và kiểu dữ liệu, nhập xuất, rẽ nhánh if/else, vòng lặp, hàm, mảng/vector và xâu. Chọn kiểu số đủ lớn cho giới hạn đề bài; trong C++, dùng long long khi int có thể bị tràn.

## Cách tự luyện

1. Đọc hai số và in tổng.
2. Dùng rẽ nhánh tìm số lớn hơn.
3. Dùng vòng lặp tính tổng từ 1 đến n.
4. Đọc một dãy số, tìm giá trị lớn nhất.

Thử với dữ liệu nhỏ nhất, dữ liệu một phần tử và các giá trị biên. Đối chiếu từng bước chạy với cách giải bằng tay.'
WHERE "id" = 'roadmap-stage-01';

UPDATE "RoadmapStage"
SET "content" = '## Đọc đề và mô hình hóa

Tách đề thành dữ liệu vào, kết quả cần in, ràng buộc và trường hợp đặc biệt. Viết lại yêu cầu bằng lời trước khi code.

## Mô phỏng và vét cạn

Mô phỏng thực hiện đúng các thao tác đề bài. Vét cạn thử mọi khả năng khi số trường hợp đủ nhỏ; đây thường là lời giải đầu tiên tốt để kiểm chứng ý tưởng.

## Độ phức tạp

Một vòng lặp qua n phần tử thường là O(n); hai vòng lặp lồng nhau thường là O(n²). Đối chiếu độ phức tạp với giới hạn n để chọn hướng giải.

## Đệ quy và kiểm thử

Đệ quy gọi lại chính nó trên trường hợp nhỏ hơn và cần có điều kiện dừng. Quay lui chọn một phương án, kiểm tra tính hợp lệ, đi sâu hơn rồi hoàn tác để thử phương án khác.

Tạo test nhỏ có đáp án tính bằng tay, kiểm tra trường hợp biên và thu nhỏ test sai để tìm bước đầu tiên khiến kết quả lệch.'
WHERE "id" = 'roadmap-stage-02';

UPDATE "RoadmapStage"
SET "content" = '## Sắp xếp và tìm kiếm

Sắp xếp dữ liệu giúp dễ so sánh. Tìm kiếm nhị phân áp dụng khi miền tìm kiếm có thứ tự hoặc điều kiện đúng/sai đơn điệu; mỗi bước loại bỏ một nửa miền nên mất O(log n).

## Mảng cộng dồn

Đặt prefix[i] là tổng từ đầu dãy đến i. Tổng đoạn [l, r] bằng prefix[r] - prefix[l - 1], xử lý riêng khi l = 0. Tiền xử lý O(n), mỗi truy vấn O(1).

## Hai con trỏ và tham lam

Hai con trỏ tận dụng thứ tự hoặc tính chất của dãy để tránh duyệt lại từ đầu. Tham lam chọn phương án tốt nhất ở bước hiện tại; cần có lập luận chứng minh lựa chọn cục bộ dẫn đến đáp án tối ưu.

## Toán tử bit

Các phép &, |, ^, << và >> thao tác trên biểu diễn nhị phân, hữu ích để lưu tập con nhỏ hoặc kiểm tra trạng thái từng bit. Kiểm tra giới hạn khi dịch bit.

Khi gặp truy vấn đoạn, nghĩ đến prefix sum; khi tìm ngưỡng tối ưu, kiểm tra tính đơn điệu để cân nhắc binary search.'
WHERE "id" = 'roadmap-stage-03';

UPDATE "RoadmapStage"
SET "content" = '## Chọn cấu trúc theo thao tác

Liệt kê các thao tác cần hỗ trợ rồi chọn cấu trúc dữ liệu có độ phức tạp phù hợp.

## Cấu trúc tuyến tính

- Stack: vào sau ra trước; hữu ích cho ngoặc và DFS lặp.
- Queue: vào trước ra trước; hữu ích cho BFS.
- Deque: thêm/xóa ở hai đầu.
- Heap/priority queue: lấy phần tử ưu tiên nhất nhanh.

## Set, map và DSU

Set lưu giá trị duy nhất có thứ tự; map ánh xạ khóa sang giá trị, thao tác thường O(log n). Bảng băm có thời gian trung bình gần O(1), không giữ thứ tự.

DSU quản lý các nhóm rời nhau, hỗ trợ tìm đại diện và gộp nhóm. Path compression cùng union by size/rank giúp thao tác gần như O(1) trung bình.

## Truy vấn đoạn

Fenwick Tree hỗ trợ cập nhật điểm và truy vấn tổng prefix trong O(log n). Segment Tree tổng quát hơn, có thể lưu min/max/tổng và mở rộng cho truy vấn đoạn.

Trước khi dùng cấu trúc phức tạp, xác định chính xác thao tác nào của bài cần tối ưu.'
WHERE "id" = 'roadmap-stage-04';

UPDATE "RoadmapStage"
SET "content" = '## Biểu diễn đồ thị

Đồ thị gồm đỉnh và cạnh, có thể có hướng/vô hướng và trọng số/không trọng số. Danh sách kề thường dùng O(V + E) bộ nhớ và phù hợp để duyệt láng giềng.

## DFS và BFS

DFS đi sâu theo một nhánh; BFS duyệt theo từng lớp. Trên đồ thị không trọng số, BFS tìm đường đi ít cạnh nhất. Dùng visited để tránh lặp vô hạn khi có chu trình.

## Đường đi ngắn nhất

- BFS cho đồ thị không trọng số.
- Dijkstra cho trọng số không âm.
- Bellman-Ford xử lý được cạnh âm và phát hiện chu trình âm.

## Cây khung và LCA

Kruskal sắp xếp cạnh và dùng DSU để tránh chu trình; Prim mở rộng cây bằng cạnh nhẹ nhất nối tới đỉnh chưa chọn.

LCA(u, v) là tổ tiên chung thấp nhất của hai đỉnh. Binary lifting lưu tổ tiên ở khoảng cách lũy thừa của hai để nâng đỉnh nhanh.

Khi đọc đề, xác định số đỉnh/cạnh, hướng cạnh, trọng số và khả năng đồ thị không liên thông.'
WHERE "id" = 'roadmap-stage-05';

UPDATE "RoadmapStage"
SET "content" = '## Khi nào dùng quy hoạch động?

Quy hoạch động phù hợp khi bài toán có các bài toán con lặp lại và đáp án lớn được ghép từ đáp án nhỏ hơn. Mô tả trạng thái bằng lời trước khi viết công thức.

## Bốn bước xây dựng DP

1. Trạng thái dp[i] hoặc dp[i][j] biểu diễn điều gì?
2. Trạng thái hiện tại nhận kết quả từ những trạng thái trước nào?
3. Các trường hợp nhỏ nhất có đáp án là gì?
4. Duyệt theo thứ tự nào để trạng thái phụ thuộc đã được tính?

## Ví dụ: không chọn hai phần tử kề nhau

Gọi dp[i] là tổng lớn nhất xét i phần tử đầu. Có thể bỏ qua phần tử i hoặc chọn nó và cộng với đáp án đến i - 2:

dp[i] = max(dp[i - 1], dp[i - 2] + a[i])

Khởi tạo trạng thái nhỏ rồi tính từ trái sang phải. Kiểm tra riêng mảng rỗng, một phần tử và giá trị âm.

## Mở rộng

DP trên lưới thường chuyển từ các ô trước; DP trên cây gộp kết quả các con; DP bitmask phù hợp khi số đối tượng nhỏ; DP trên xâu có thể mô tả tiền tố hoặc đoạn con.

Sau khi có lời giải đúng, phân tích số trạng thái và số chuyển tiếp. Với n nhỏ, so sánh kết quả DP với vét cạn để kiểm chứng công thức.'
WHERE "id" = 'roadmap-stage-06';
