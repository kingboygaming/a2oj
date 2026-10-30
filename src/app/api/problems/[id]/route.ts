import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const problem = await prisma.problem.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      author: { select: { displayName: true, username: true } },
      testCases: { orderBy: { order: "asc" } },
    },
  });

  if (!problem) {
    return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
  }

  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  if (!problem.published && !staff && user?.id !== problem.authorId) {
    return NextResponse.json({ error: "Bài chưa được duyệt." }, { status: 403 });
  }
  if (problem.contestOnly && !staff) {
    const contestId = new URL(request.url).searchParams.get("contest");
    const contestProblem = contestId
      ? await prisma.contestProblem.findFirst({
          where: {
            problemId: problem.id,
            contest: { OR: [{ id: contestId }, { slug: contestId }] },
          },
          select: { problemId: true },
        })
      : null;
    if (!contestProblem) {
      return NextResponse.json({ error: "Bài chỉ khả dụng trong contest." }, { status: 404 });
    }
  }

  const testCases = problem.testCases.map((t) =>
    t.isSample || staff
      ? t
      : { ...t, input: "", output: "", hidden: true },
  );

  return NextResponse.json({ ...problem, testCases });
}
