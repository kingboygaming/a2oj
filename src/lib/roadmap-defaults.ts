export type RoadmapResource = { label: string; href: string };

export type RoadmapStageData = {
  id: string;
  sortOrder: number;
  level: string;
  title: string;
  description: string;
  topics: string[];
  checkpoint: string;
  resources: RoadmapResource[];
};

export const defaultRoadmapStages: RoadmapStageData[] = [
  {
    id: "roadmap-stage-01",
    sortOrder: 1,
    level: "Bắt đầu",
    title: "Làm quen với lập trình",
    description: "Nắm chắc công cụ và cách diễn đạt một lời giải thành chương trình.",
    topics: ["C++ cơ bản, biến và kiểu dữ liệu", "Nhập xuất, rẽ nhánh và vòng lặp", "Hàm, mảng và xâu ký tự"],
    checkpoint: "Tự viết được chương trình nhỏ và giải thích từng bước chạy.",
    resources: [{ label: "Lộ trình tổng quan", href: "https://wiki.vnoi.info/roadmap/general-roadmap" }],
  },
  {
    id: "roadmap-stage-02",
    sortOrder: 2,
    level: "Tư duy giải bài",
    title: "Phân tích và thử nghiệm",
    description: "Học cách đọc đề, chia trường hợp và kiểm tra lời giải với dữ liệu nhỏ.",
    topics: ["Mô phỏng và vét cạn", "Độ phức tạp thời gian cơ bản", "Đệ quy và quay lui"],
    checkpoint: "Biết tự tạo test nhỏ để tìm lỗi và ước lượng lời giải có đủ nhanh không.",
    resources: [{ label: "Kỹ thuật quay lui", href: "https://wiki.vnoi.info/vi/algo/basic/backtracking" }],
  },
  {
    id: "roadmap-stage-03",
    sortOrder: 3,
    level: "Nền tảng",
    title: "Mảng và thuật toán cơ bản",
    description: "Xây nền tảng thường gặp trong các bài thi và học cách tối ưu lời giải.",
    topics: ["Sắp xếp và tìm kiếm nhị phân", "Mảng cộng dồn và mảng hiệu", "Hai con trỏ, tham lam và toán tử bit"],
    checkpoint: "Nhận ra được khi nào có thể thay một vòng lặp lồng nhau bằng kỹ thuật phù hợp.",
    resources: [
      { label: "Prefix sum và difference array", href: "https://wiki.vnoi.info/algo/data-structures/prefix-sum-and-difference-array.md" },
      { label: "Toán tử bit", href: "https://wiki.vnoi.info/algo/basic/bitwise-operators" },
    ],
  },
  {
    id: "roadmap-stage-04",
    sortOrder: 4,
    level: "Trung cấp",
    title: "Cấu trúc dữ liệu",
    description: "Chọn cách lưu trữ và truy vấn dữ liệu hiệu quả theo yêu cầu bài toán.",
    topics: ["Stack, queue, deque và heap", "Set, map và bảng băm", "Disjoint Set Union, Fenwick Tree và Segment Tree"],
    checkpoint: "Giải thích được cấu trúc dữ liệu giúp giảm thời gian hoặc đơn giản hóa thao tác nào.",
    resources: [{ label: "Lộ trình tổng quan", href: "https://wiki.vnoi.info/roadmap/general-roadmap" }],
  },
  {
    id: "roadmap-stage-05",
    sortOrder: 5,
    level: "Trung cấp",
    title: "Đồ thị",
    description: "Mô hình hóa quan hệ giữa các đối tượng và tìm đường đi hoặc cấu trúc tối ưu.",
    topics: ["DFS, BFS và thành phần liên thông", "Đường đi ngắn nhất và cây khung nhỏ nhất", "Cây, tổ tiên chung gần nhất (LCA)"],
    checkpoint: "Chọn được cách biểu diễn đồ thị và thuật toán phù hợp với giới hạn đề bài.",
    resources: [{ label: "LCA với Binary Lifting", href: "https://wiki.vnoi.info/algo/data-structures/lca-binlift.md" }],
  },
  {
    id: "roadmap-stage-06",
    sortOrder: 6,
    level: "Nâng cao",
    title: "Quy hoạch động và chủ đề mở rộng",
    description: "Luyện cách nhận diện trạng thái, xây dựng chuyển tiếp và kết hợp nhiều kỹ thuật.",
    topics: ["Quy hoạch động một chiều và trên lưới", "DP trên dãy, cây hoặc bitmask", "Thuật toán chuỗi, toán rời rạc và tối ưu hóa"],
    checkpoint: "Tự định nghĩa trạng thái, điều kiện đầu và công thức chuyển tiếp trước khi code.",
    resources: [{ label: "Lộ trình tổng quan", href: "https://wiki.vnoi.info/roadmap/general-roadmap" }],
  },
];
