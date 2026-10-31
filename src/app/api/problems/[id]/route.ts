import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 60;

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

  const canViewAllTests = staff || user?.id === problem.authorId;
  const testCases = problem.testCases.map((t) =>
    t.isSample || canViewAllTests
      ? t
      : { ...t, input: "", output: "", hidden: true },
  );

  return NextResponse.json({ ...problem, testCases });
}

const testCaseSchema = z.object({
  input: z.string(),
  output: z.string(),
  isSample: z.boolean().optional(),
  points: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(120),
  statement: z.string().min(10),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  timeLimitMs: z.number().int().positive(),
  memoryLimitMb: z.number().int().positive(),
  ioMode: z.enum(["STDIO", "FILE"]).optional().default("STDIO"),
  judgeType: z.enum(["STANDARD", "HEURISTIC"]).optional().default("STANDARD"),
  heuristicTolerancePercent: z.number().int().min(0).max(100).optional().default(5),
  inputFile: z.string().trim().max(100).nullable().optional(),
  outputFile: z.string().trim().max(100).nullable().optional(),
  testCases: z.array(testCaseSchema).min(1),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  const problem = await prisma.problem.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, authorId: true, published: true },
  });

  if (!problem) {
    return NextResponse.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
  }

  const canEdit =
    user.role === "ADMIN" ||
    (!problem.published && problem.authorId === user.id);

  if (!canEdit) {
    return NextResponse.json(
      {
        error: problem.published
          ? "Bài tập đã được duyệt, chỉ quản trị viên mới có thể chỉnh sửa."
          : "Bạn không có quyền chỉnh sửa bài tập này.",
      },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu đề bài không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const slugOwner = await prisma.problem.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (slugOwner && slugOwner.id !== problem.id) {
    return NextResponse.json({ error: "Slug đã được dùng bởi bài tập khác." }, { status: 409 });
  }

  await prisma.$transaction(
    async (transaction) => {
      await transaction.problem.update({
        where: { id: problem.id },
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          statement: parsed.data.statement,
          difficulty: parsed.data.difficulty,
          timeLimitMs: parsed.data.timeLimitMs,
          memoryLimitMb: parsed.data.memoryLimitMb,
          ioMode: parsed.data.ioMode ?? "STDIO",
          judgeType: parsed.data.judgeType ?? "STANDARD",
          heuristicTolerancePercent: parsed.data.heuristicTolerancePercent ?? 5,
          inputFile: parsed.data.ioMode === "FILE" ? (parsed.data.inputFile || `${parsed.data.slug.toUpperCase()}.INP`) : null,
          outputFile: parsed.data.ioMode === "FILE" ? (parsed.data.outputFile || `${parsed.data.slug.toUpperCase()}.OUT`) : null,
        },
      });
      await transaction.testCase.deleteMany({ where: { problemId: problem.id } });
      await transaction.testCase.createMany({
        data: parsed.data.testCases.map((testCase, order) => ({
          input: testCase.input,
          output: testCase.output,
          isSample: testCase.isSample ?? false,
          points: testCase.points ?? (testCase.isSample ? 0 : 100),
          problemId: problem.id,
          order,
        })),
      });
    },
    { timeout: 60_000 },
  );

  return NextResponse.json({ success: true, slug: parsed.data.slug });
}
