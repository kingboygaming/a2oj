import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      problems: {
        include: {
          problem: {
            select: { id: true, slug: true, title: true },
          },
        },
      },
      submissions: {
        where: {
          score: { gt: 0 }, // Chỉ lấy bài nộp có điểm > 0
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        include: {
          user: { select: { username: true } },
          problem: { select: { slug: true } },
        },
      },
    },
  });

  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  // Quyền: Chỉ ADMIN hoặc người tạo contest mới được tải
  if (user.role !== "ADMIN" && contest.authorId !== user.id) {
    return NextResponse.json(
      { error: "Bạn không có quyền tải bài nộp contest này." },
      { status: 403 },
    );
  }

  // Lọc lấy bài nộp điểm cao nhất của mỗi thí sinh cho mỗi bài tập
  // Map key: `${username}:${problemSlug}` -> submission
  const bestSubmissions = new Map<string, (typeof contest.submissions)[number]>();

  for (const sub of contest.submissions) {
    const key = `${sub.user.username}:${sub.problem.slug}`;
    if (!bestSubmissions.has(key)) {
      bestSubmissions.set(key, sub);
    }
  }

  const files: Record<string, Uint8Array> = {};

  for (const sub of bestSubmissions.values()) {
    const ext = sub.language === "PYTHON" ? "py" : "cpp";
    // Tên file theo chuẩn Themis: [TênThíSinh]/[MãBài].[ext]
    const taskName = sub.problem.slug.toUpperCase();
    const filePath = `${sub.user.username}/${taskName}.${ext}`;
    files[filePath] = strToU8(sub.source);
  }

  if (Object.keys(files).length === 0) {
    files["README.txt"] = strToU8(
      "Không có bài nộp nào đạt điểm > 0 trong contest này (các bài 0 điểm hoặc lỗi biên dịch đã tự động được lọc bỏ)."
    );
  }

  const zipped = zipSync(files);

  return new NextResponse(Buffer.from(zipped), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="themis-${contest.slug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
