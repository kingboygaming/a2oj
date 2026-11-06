export type RoadmapResource = { label: string; href: string };

export type RoadmapStageData = {
  id: string;
  sortOrder: number;
  level: string;
  title: string;
  description: string;
  topics: string[];
  content: string;
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
    content: `## Mục tiêu

Một chương trình nhận dữ liệu, xử lý theo các bước rõ ràng rồi in ra kết quả. Hãy bắt đầu bằng C++ hoặc Python và luyện cách biến yêu cầu của đề thành những bước nhỏ.

## Nội dung cần học

### Biến và kiểu dữ liệu

Biến lưu dữ liệu để chương trình sử dụng. Làm quen với số nguyên, số thực, ký tự, chuỗi và giá trị đúng/sai. Chọn kiểu dữ liệu đủ lớn cho giới hạn đề bài; trong C++, dùng \`long long\` khi kết quả có thể vượt phạm vi của \`int\`.

### Nhập xuất

Đọc đúng định dạng đầu vào và in chính xác kết quả được yêu cầu. Với C++, có thể dùng \`ios::sync_with_stdio(false);\` và \`cin.tie(nullptr);\` trước khi đọc nhiều dữ liệu.

### Rẽ nhánh và vòng lặp

Dùng \`if/else\` để xử lý các trường hợp. Dùng vòng lặp khi một thao tác cần lặp lại; hãy xác định rõ điểm bắt đầu, điều kiện dừng và biến được cập nhật.

### Hàm, mảng và xâu

Tách thao tác lặp lại thành hàm có đầu vào và kết quả rõ ràng. Mảng/vector lưu nhiều giá trị cùng loại; xâu dùng để xử lý văn bản. Luôn chú ý chỉ số bắt đầu từ 0 trong C++.

## Cách tự luyện

1. Viết chương trình đọc hai số và in tổng của chúng.
2. Dùng rẽ nhánh để tìm số lớn hơn trong hai số.
3. Dùng vòng lặp để tính tổng từ 1 đến n.
4. Đọc một dãy số, tìm giá trị lớn nhất và in vị trí của nó.

## Ghi nhớ

Trước khi nộp bài, thử với dữ liệu nhỏ nhất, dữ liệu có một phần tử và các giá trị biên. Đối chiếu từng bước tính toán của chương trình với cách giải bằng tay.`,
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
    content: `## Đọc đề và mô hình hóa

Tách đề thành bốn phần: dữ liệu vào, kết quả cần in, ràng buộc và các trường hợp đặc biệt. Viết lại yêu cầu bằng lời của mình trước khi code để tránh bỏ sót điều kiện.

## Mô phỏng và vét cạn

Mô phỏng thực hiện đúng các thao tác mà đề mô tả. Vét cạn thử mọi khả năng khi số trường hợp đủ nhỏ. Đây thường là lời giải đầu tiên tốt để kiểm chứng ý tưởng, kể cả khi sau đó cần tối ưu.

## Độ phức tạp

Độ phức tạp mô tả tốc độ tăng thời gian hoặc bộ nhớ khi kích thước đầu vào tăng. Một vòng lặp qua n phần tử thường là O(n); hai vòng lặp lồng nhau thường là O(n²). Đối chiếu độ phức tạp với giới hạn n để quyết định hướng giải.

## Đệ quy và quay lui

Đệ quy giải bài toán bằng cách gọi lại chính nó trên trường hợp nhỏ hơn. Cần có điều kiện dừng để kết thúc. Quay lui lần lượt chọn một phương án, kiểm tra tính hợp lệ, đi sâu hơn rồi hoàn tác lựa chọn để thử phương án khác.

## Quy trình kiểm thử

1. Tạo test nhỏ có thể tính đáp án bằng tay.
2. Thử trường hợp biên: n nhỏ nhất, giá trị lặp, dữ liệu tăng/giảm.
3. Với vét cạn, so sánh kết quả với một lời giải tối ưu trên nhiều test nhỏ.
4. Khi sai, thu nhỏ test để tìm bước đầu tiên khiến kết quả lệch.

## Bài tập tự luyện

Viết chương trình liệt kê mọi cặp số trong dãy có tổng bằng k. Bắt đầu bằng vét cạn O(n²), sau đó đoán xem có thể cải thiện bằng cách nào.`,
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
    content: `## Sắp xếp và tìm kiếm

Sắp xếp đưa dữ liệu về thứ tự để dễ so sánh hoặc xử lý. Trong C++, dùng \`sort(a.begin(), a.end())\`. Tìm kiếm nhị phân áp dụng khi miền tìm kiếm đã có thứ tự hoặc điều kiện đúng/sai có tính đơn điệu; mỗi bước loại bỏ một nửa miền nên mất O(log n).

## Mảng cộng dồn

Đặt \`prefix[i]\` là tổng các phần tử từ đầu dãy đến i. Khi đó tổng đoạn [l, r] tính được bằng \`prefix[r] - prefix[l - 1]\` (xử lý riêng khi l = 0). Tiền xử lý O(n), mỗi truy vấn O(1).

## Hai con trỏ và cửa sổ trượt

Hai con trỏ duyệt dãy bằng hai vị trí thay đổi có quy luật, thường áp dụng sau khi sắp xếp hoặc với dãy thỏa tính chất phù hợp. Cửa sổ trượt duy trì thông tin một đoạn liên tiếp; mở rộng một đầu và thu hẹp đầu kia thay vì tính lại từ đầu.

## Tham lam

Thuật toán tham lam chọn phương án có vẻ tốt nhất ở bước hiện tại. Không phải lựa chọn cục bộ nào cũng dẫn đến đáp án tối ưu; hãy tìm lập luận chứng minh hoặc phản ví dụ trước khi tin vào chiến lược.

## Toán tử bit

Các phép \`&\`, \`|\`, \`^\`, \`<<\` và \`>>\` thao tác trên biểu diễn nhị phân. Chúng hữu ích để lưu tập con nhỏ hoặc kiểm tra trạng thái từng bit. Dùng kiểu số nguyên không âm và kiểm tra giới hạn khi dịch bit.

## Cách tiếp cận

Khi gặp truy vấn đoạn, nghĩ đến prefix sum. Khi tìm một ngưỡng nhỏ nhất/lớn nhất, kiểm tra tính đơn điệu để cân nhắc binary search. Khi duyệt cặp phần tử, xem sắp xếp hoặc hai con trỏ có giúp giảm số lần kiểm tra không.`,
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
    content: `## Chọn cấu trúc theo thao tác

Cấu trúc dữ liệu phù hợp giúp thêm, xóa, tìm hoặc truy vấn dữ liệu nhanh hơn. Trước khi chọn, liệt kê các thao tác cần hỗ trợ và độ phức tạp mong muốn.

## Các cấu trúc tuyến tính

- **Stack**: vào sau ra trước; dùng cho ngoặc, biểu thức và DFS lặp.
- **Queue**: vào trước ra trước; dùng trong BFS.
- **Deque**: thêm/xóa ở hai đầu.
- **Heap / priority queue**: lấy phần tử ưu tiên nhất nhanh, thường dùng để xử lý min/max liên tục.

## Set và map

\`set\` lưu các giá trị duy nhất có thứ tự; \`map\` ánh xạ khóa sang giá trị. Các thao tác thường mất O(log n). Bảng băm như \`unordered_map\` có thời gian trung bình gần O(1), nhưng không giữ thứ tự.

## Disjoint Set Union

DSU quản lý các nhóm rời nhau, hỗ trợ tìm đại diện và gộp hai nhóm. Path compression cùng union by size/rank giúp thao tác gần như O(1) trung bình. Dùng khi cần trả lời nhanh hai đỉnh có cùng thành phần hay không.

## Fenwick Tree và Segment Tree

Fenwick Tree hỗ trợ cập nhật điểm và truy vấn tổng prefix trong O(log n). Segment Tree tổng quát hơn, có thể lưu min/max/tổng và mở rộng cho truy vấn đoạn, nhưng cài đặt dài hơn.

## Luyện tập

Với mỗi bài, viết rõ thao tác nào cần tối ưu. So sánh phương án mảng, set/map, DSU hoặc cây truy vấn đoạn; chỉ dùng cấu trúc phức tạp hơn khi thao tác của bài yêu cầu.`,
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
    content: `## Biểu diễn đồ thị

Đồ thị gồm đỉnh và cạnh, có thể có hướng/vô hướng và trọng số/không trọng số. Danh sách kề thường tiết kiệm bộ nhớ O(V + E) và phù hợp để duyệt láng giềng.

## DFS và BFS

DFS đi sâu theo một nhánh trước; BFS duyệt theo từng lớp. Trên đồ thị không trọng số, BFS tìm được đường đi ít cạnh nhất. Dùng mảng visited để tránh lặp vô hạn khi đồ thị có chu trình. Mỗi lần bắt đầu từ đỉnh chưa thăm sẽ tìm được một thành phần liên thông.

## Đường đi ngắn nhất

- BFS cho đồ thị không trọng số.
- Dijkstra cho trọng số không âm.
- Bellman–Ford xử lý được cạnh âm và phát hiện chu trình âm.

Chọn thuật toán dựa trên tính chất trọng số, không chỉ dựa trên kích thước đồ thị.

## Cây khung nhỏ nhất

Kruskal sắp xếp cạnh theo trọng số và dùng DSU để tránh tạo chu trình. Prim mở rộng cây từ một đỉnh bằng cạnh nhẹ nhất nối sang đỉnh chưa chọn.

## Cây và LCA

Cây là đồ thị liên thông không chu trình. DFS có thể tính cha, độ sâu và thứ tự vào/ra. LCA(u, v) là tổ tiên chung thấp nhất của hai đỉnh; binary lifting lưu tổ tiên ở khoảng cách lũy thừa của hai để nâng đỉnh nhanh.

## Tự kiểm tra

Với mỗi bài đồ thị, xác định số đỉnh/cạnh, hướng cạnh, trọng số và đồ thị có thể không liên thông hay không. Những chi tiết này quyết định cách khởi tạo và thuật toán.`,
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
    content: `## Khi nào dùng quy hoạch động?

Quy hoạch động (DP) phù hợp khi bài toán có các bài toán con lặp lại và đáp án lớn được ghép từ đáp án nhỏ hơn. Hãy bắt đầu bằng việc mô tả trạng thái bằng lời trước khi viết công thức.

## Bốn bước xây dựng DP

1. **Trạng thái:** \`dp[i]\` hoặc \`dp[i][j]\` biểu diễn điều gì?
2. **Chuyển trạng thái:** trạng thái hiện tại nhận kết quả từ những trạng thái trước nào?
3. **Khởi tạo:** các trường hợp nhỏ nhất có đáp án là gì?
4. **Thứ tự tính:** cần duyệt trạng thái theo chiều nào để dữ liệu phụ thuộc đã có?

## Ví dụ: tổng lớn nhất không lấy hai phần tử kề nhau

Gọi \`dp[i]\` là tổng lớn nhất xét i phần tử đầu. Với phần tử i, ta có thể bỏ qua nó (\`dp[i - 1]\`) hoặc chọn nó và cộng với đáp án đến i - 2. Vì vậy:

\`\`\`text
dp[i] = max(dp[i - 1], dp[i - 2] + a[i])
\`\`\`

Khởi tạo các trạng thái nhỏ rồi tính từ trái sang phải. Luôn kiểm tra trường hợp mảng rỗng, một phần tử và phần tử âm theo đúng điều kiện bài toán.

## Mở rộng

- DP trên lưới: trạng thái thường là ô (i, j), chuyển từ các ô có thể đi tới.
- DP trên cây: tính kết quả từ các con rồi gộp tại cha.
- DP bitmask: một mask biểu diễn tập đối tượng đã chọn, phù hợp khi số đối tượng nhỏ.
- Xâu: quy hoạch động có thể mô tả tiền tố hoặc đoạn con, ví dụ LCS.

## Tối ưu và kiểm chứng

Sau khi có lời giải đúng, phân tích số trạng thái và số chuyển tiếp. Chỉ tối ưu bộ nhớ khi nhận ra trạng thái nào không còn cần dùng. Với n nhỏ, so sánh DP với vét cạn để kiểm tra công thức.`,
    checkpoint: "Tự định nghĩa trạng thái, điều kiện đầu và công thức chuyển tiếp trước khi code.",
    resources: [{ label: "Lộ trình tổng quan", href: "https://wiki.vnoi.info/roadmap/general-roadmap" }],
  },
];
