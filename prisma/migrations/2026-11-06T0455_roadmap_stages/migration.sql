CREATE TABLE "RoadmapStage" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "checkpoint" TEXT NOT NULL,
    "resources" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapStage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoadmapStage_sortOrder_idx" ON "RoadmapStage"("sortOrder");

INSERT INTO "RoadmapStage" ("id", "sortOrder", "level", "title", "description", "topics", "checkpoint", "resources", "updatedAt")
VALUES
    ('roadmap-stage-01', 1, 'Bắt đầu', 'Làm quen với lập trình', 'Nắm chắc công cụ và cách diễn đạt một lời giải thành chương trình.', '["C++ cơ bản, biến và kiểu dữ liệu","Nhập xuất, rẽ nhánh và vòng lặp","Hàm, mảng và xâu ký tự"]', 'Tự viết được chương trình nhỏ và giải thích từng bước chạy.', '[{"label":"Lộ trình tổng quan","href":"https://wiki.vnoi.info/roadmap/general-roadmap"}]', CURRENT_TIMESTAMP),
    ('roadmap-stage-02', 2, 'Tư duy giải bài', 'Phân tích và thử nghiệm', 'Học cách đọc đề, chia trường hợp và kiểm tra lời giải với dữ liệu nhỏ.', '["Mô phỏng và vét cạn","Độ phức tạp thời gian cơ bản","Đệ quy và quay lui"]', 'Biết tự tạo test nhỏ để tìm lỗi và ước lượng lời giải có đủ nhanh không.', '[{"label":"Kỹ thuật quay lui","href":"https://wiki.vnoi.info/vi/algo/basic/backtracking"}]', CURRENT_TIMESTAMP),
    ('roadmap-stage-03', 3, 'Nền tảng', 'Mảng và thuật toán cơ bản', 'Xây nền tảng thường gặp trong các bài thi và học cách tối ưu lời giải.', '["Sắp xếp và tìm kiếm nhị phân","Mảng cộng dồn và mảng hiệu","Hai con trỏ, tham lam và toán tử bit"]', 'Nhận ra được khi nào có thể thay một vòng lặp lồng nhau bằng kỹ thuật phù hợp.', '[{"label":"Prefix sum và difference array","href":"https://wiki.vnoi.info/algo/data-structures/prefix-sum-and-difference-array.md"},{"label":"Toán tử bit","href":"https://wiki.vnoi.info/algo/basic/bitwise-operators"}]', CURRENT_TIMESTAMP),
    ('roadmap-stage-04', 4, 'Trung cấp', 'Cấu trúc dữ liệu', 'Chọn cách lưu trữ và truy vấn dữ liệu hiệu quả theo yêu cầu bài toán.', '["Stack, queue, deque và heap","Set, map và bảng băm","Disjoint Set Union, Fenwick Tree và Segment Tree"]', 'Giải thích được cấu trúc dữ liệu giúp giảm thời gian hoặc đơn giản hóa thao tác nào.', '[{"label":"Lộ trình tổng quan","href":"https://wiki.vnoi.info/roadmap/general-roadmap"}]', CURRENT_TIMESTAMP),
    ('roadmap-stage-05', 5, 'Trung cấp', 'Đồ thị', 'Mô hình hóa quan hệ giữa các đối tượng và tìm đường đi hoặc cấu trúc tối ưu.', '["DFS, BFS và thành phần liên thông","Đường đi ngắn nhất và cây khung nhỏ nhất","Cây, tổ tiên chung gần nhất (LCA)"]', 'Chọn được cách biểu diễn đồ thị và thuật toán phù hợp với giới hạn đề bài.', '[{"label":"LCA với Binary Lifting","href":"https://wiki.vnoi.info/algo/data-structures/lca-binlift.md"}]', CURRENT_TIMESTAMP),
    ('roadmap-stage-06', 6, 'Nâng cao', 'Quy hoạch động và chủ đề mở rộng', 'Luyện cách nhận diện trạng thái, xây dựng chuyển tiếp và kết hợp nhiều kỹ thuật.', '["Quy hoạch động một chiều và trên lưới","DP trên dãy, cây hoặc bitmask","Thuật toán chuỗi, toán rời rạc và tối ưu hóa"]', 'Tự định nghĩa trạng thái, điều kiện đầu và công thức chuyển tiếp trước khi code.', '[{"label":"Lộ trình tổng quan","href":"https://wiki.vnoi.info/roadmap/general-roadmap"}]', CURRENT_TIMESTAMP);
