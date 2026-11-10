import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const reviewSchema = z.object({
  action: z.literal("approve"),
});

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
  judgeType: z.enum(["STANDARD", "HEURISTIC", "INTERACTIVE"]).optional().default("STANDARD"),
  interactorSource: z.string().max(64_000).nullable().optional(),
  heuristicTolerancePercent: z.number().int().min(0).max(100).optional().default(5),
  achievementBadgeTitle: z.string().trim().max(80).nullable().optional(),
  achievementBadgeDescription: z.string().trim().max(180).nullable().optional(),
  achievementScoreThreshold: z.number().int().min(1).max(10000).nullable().optional(),
  inputFile: z.string().trim().max(100).nullable().optional(),
  outputFile: z.string().trim().max(100).nullable().optional(),
  testCases: z.array(testCaseSchema).min(1),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(32)).max(10).optional().default([]).transform((tags) => [...new Set(tags)]),
}).superRefine((data, context) => {
  if (data.judgeType === "INTERACTIVE" && !data.interactorSource?.trim()) {
    context.addIssue({ code: "custom", path: ["interactorSource"], message: "Bộ chấm Interactive cần mã interactor C++." });
  }
  if (data.judgeType === "INTERACTIVE" && data.ioMode !== "STDIO") {
    context.addIssue({ code: "custom", path: ["ioMode"], message: "Bài Interactive chỉ hỗ trợ stdin/stdout." });
  }
  if (data.judgeType === "INTERACTIVE" && data.testCases.length > 20) {
    context.addIssue({ code: "custom", path: ["testCases"], message: "Bài Interactive hỗ trợ tối đa 20 test." });
  }
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
  const problem = await prisma.problem.findUnique({
    where: { id },
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
  if (slugOwner && slugOwner.id !== id) {
    return NextResponse.json({ error: "Slug đã được dùng bởi bài tập khác." }, { status: 409 });
  }

  await prisma.$transaction(
    async (transaction) => {
      await transaction.problem.update({
        where: { id },
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          statement: parsed.data.statement,
          difficulty: parsed.data.difficulty,
          timeLimitMs: parsed.data.timeLimitMs,
          memoryLimitMb: parsed.data.memoryLimitMb,
          ioMode: parsed.data.ioMode ?? "STDIO",
          judgeType: parsed.data.judgeType ?? "STANDARD",
          interactorSource: parsed.data.judgeType === "INTERACTIVE" ? parsed.data.interactorSource?.trim() : null,
          heuristicTolerancePercent: parsed.data.heuristicTolerancePercent ?? 5,
          achievementBadgeTitle: parsed.data.judgeType === "HEURISTIC" ? parsed.data.achievementBadgeTitle || null : null,
          achievementBadgeDescription: parsed.data.judgeType === "HEURISTIC" && parsed.data.achievementBadgeTitle ? parsed.data.achievementBadgeDescription || null : null,
          achievementScoreThreshold: parsed.data.judgeType === "HEURISTIC" && parsed.data.achievementBadgeTitle ? parsed.data.achievementScoreThreshold ?? 90 : null,
          inputFile: parsed.data.ioMode === "FILE" ? (parsed.data.inputFile || `${parsed.data.slug.toUpperCase()}.INP`) : null,
          outputFile: parsed.data.ioMode === "FILE" ? (parsed.data.outputFile || `${parsed.data.slug.toUpperCase()}.OUT`) : null,
          tags: {
            set: [],
            connectOrCreate: [...new Set(parsed.data.tags)].map((name) => ({ where: { name }, create: { name } })),
          },
        },
      });
      await transaction.testCase.deleteMany({ where: { problemId: id } });
      await transaction.testCase.createMany({
        data: parsed.data.testCases.map((testCase, order) => ({
          input: testCase.input,
          output: testCase.output,
          isSample: testCase.isSample ?? false,
          points: testCase.points ?? (testCase.isSample ? 0 : 100),
          problemId: id,
          order,
        })),
      });
    },
    { timeout: 60_000 },
  );

  return NextResponse.json({ success: true, slug: parsed.data.slug });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu duyệt đề không hợp lệ." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await prisma.problem.updateMany({
    where: { id, published: false },
    data: { published: true },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "Không tìm thấy đề đang chờ duyệt." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
