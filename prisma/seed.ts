import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.submission.deleteMany();
  await prisma.contestRegistration.deleteMany();
  await prisma.contestProblem.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.news.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("teacher123", 10);
  const studentHash = await bcrypt.hash("hs123", 10);

  const teacher = await prisma.user.create({
    data: {
      username: "gv",
      displayName: "Cô Minh",
      passwordHash,
      role: "TEACHER",
    },
  });

  const student = await prisma.user.create({
    data: {
      username: "hs",
      displayName: "Nguyễn An",
      passwordHash: studentHash,
      role: "STUDENT",
    },
  });

  await prisma.news.createMany({
    data: [
      {
        title: "Khai giảng khối chuyên Tin — lịch luyện OJ",
        body: "Từ tuần này, mỗi tối 20:00 lớp nộp bài trên OJ. Ưu tiên các bài **A+B**, **Tổng dãy**, rồi mới sang đồ thị.",
        pinned: true,
        authorId: teacher.id,
      },
      {
        title: "Quy chế nộp bài",
        body: "Chọn đúng ngôn ngữ C++17 hoặc Python 3. Đọc kỹ giới hạn thời gian. Không copy code từ ngoài lớp khi đang contest.",
        pinned: false,
        authorId: teacher.id,
      },
    ],
  });

  const ab = await prisma.problem.create({
    data: {
      slug: "a-cong-b",
      title: "A cộng B",
      difficulty: "EASY",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      authorId: teacher.id,
      statement: `Cho hai số nguyên $a$ và $b$. Tính $a + b$.

## Input

Một dòng gồm hai số nguyên $a, b$ ($-10^9 \\le a, b \\le 10^9$).

## Output

Một số nguyên — giá trị $a + b$.

## Ghi chú

Bài khởi động để kiểm tra môi trường nộp bài.`,
      testCases: {
        create: [
          { input: "1 2\n", output: "3\n", isSample: true, order: 0, points: 0 },
          { input: "-5 10\n", output: "5\n", isSample: true, order: 1, points: 0 },
          { input: "100 200\n", output: "300\n", isSample: false, order: 2, points: 50 },
          { input: "-1000000000 1000000000\n", output: "0\n", isSample: false, order: 3, points: 50 },
        ],
      },
    },
  });

  const sumN = await prisma.problem.create({
    data: {
      slug: "tong-1-n",
      title: "Tổng 1 đến n",
      difficulty: "EASY",
      timeLimitMs: 1000,
      authorId: teacher.id,
      statement: `Cho số nguyên dương $n$. Tính

$$
S = \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

## Input

Một số nguyên $n$ ($1 \\le n \\le 10^9$).

## Output

In $S$. Chú ý tràn số nếu dùng \`int\` 32-bit.`,
      testCases: {
        create: [
          { input: "3\n", output: "6\n", isSample: true, order: 0, points: 0 },
          { input: "1\n", output: "1\n", isSample: false, order: 1, points: 40 },
          { input: "1000000000\n", output: "500000000500000000\n", isSample: false, order: 2, points: 60 },
        ],
      },
    },
  });

  await prisma.problem.create({
    data: {
      slug: "so-nguyen-to",
      title: "Kiểm tra số nguyên tố",
      difficulty: "MEDIUM",
      timeLimitMs: 1000,
      authorId: teacher.id,
      statement: `Cho số nguyên $n$. In \`YES\` nếu $n$ là số nguyên tố, ngược lại in \`NO\`.

Số nguyên tố là số nguyên $> 1$ chỉ có đúng hai ước: $1$ và chính nó.

## Input

Một số nguyên $n$ ($1 \\le n \\le 10^{12}$).

## Output

\`YES\` hoặc \`NO\`.`,
      testCases: {
        create: [
          { input: "7\n", output: "YES\n", isSample: true, order: 0, points: 0 },
          { input: "1\n", output: "NO\n", isSample: true, order: 1, points: 0 },
          { input: "999999999989\n", output: "YES\n", isSample: false, order: 2, points: 100 },
        ],
      },
    },
  });

  const now = Date.now();
  await prisma.contest.create({
    data: {
      slug: "luyen-tap-tuan-1",
      title: "Luyện tập tuần 1",
      description: "Contest nội bộ khối 10 chuyên Tin. 90 phút, 2 bài.",
      startAt: new Date(now - 60 * 60 * 1000),
      endAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      authorId: teacher.id,
      problems: {
        create: [
          { problemId: ab.id, letter: "A", points: 100 },
          { problemId: sumN.id, letter: "B", points: 100 },
        ],
      },
      registrations: {
        create: [{ userId: student.id }],
      },
    },
  });

  console.log("Seed OK. Tài khoản: gv / teacher123  và  hs / hs123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
