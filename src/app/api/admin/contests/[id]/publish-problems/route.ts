import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  problemIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có thể đưa bài ra kho đề." }, { status: 403 });
  }

  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, endAt: true },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }
  if (contest.endAt > new Date()) {
    return NextResponse.json({ error: "Chỉ có thể đưa bài ra kho sau khi contest kết thúc." }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Danh sách bài cần đưa ra không hợp lệ." }, { status: 400 });
  }
  if (new Set(parsed.data.problemIds).size !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Danh sách bài bị trùng." }, { status: 400 });
  }

  const linkedProblems = await prisma.contestProblem.findMany({
    where: { contestId: contest.id, problemId: { in: parsed.data.problemIds } },
    select: { problemId: true },
  });
  if (linkedProblems.length !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Một hoặc nhiều bài không thuộc contest này." }, { status: 400 });
  }

  const result = await prisma.problem.updateMany({
    where: { id: { in: parsed.data.problemIds } },
    data: { published: true, contestOnly: false },
  });

  return NextResponse.json({ success: true, published: result.count });
}
