import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageContests, getCurrentUser, hasContestAccess } from "@/lib/auth";
import { hashContestPassword } from "@/lib/contest-password";
import { SCORING_MODES } from "@/lib/scoring";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      author: { select: { displayName: true } },
      problems: {
        include: {
          problem: {
            select: {
              id: true,
              slug: true,
              title: true,
              difficulty: true,
              contestOnly: true,
              statement: true,
              timeLimitMs: true,
              memoryLimitMb: true,
            },
          },
        },
        orderBy: { letter: "asc" },
      },
      _count: { select: { registrations: true } },
    },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }
  const user = await getCurrentUser();
  const organizer = user?.role === "ADMIN" || user?.id === contest.authorId;
  const unlocked = organizer || await hasContestAccess(contest.id, contest.passwordHash);
  if (!organizer && (!unlocked || new Date() < contest.startAt)) {
    return NextResponse.json({ error: "Contest chưa mở đề bài." }, { status: 403 });
  }
  const { passwordHash: _passwordHash, ...safeContest } = contest;
  return NextResponse.json(safeContest);
}

const updateContestSchema = z.object({
  slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  testLimit: z.number().int().min(0).max(100).default(5),
  scoringMode: z.enum(SCORING_MODES).optional().default("ICPC"),
  gachaAcRewardMin: z.number().int().min(0).max(1000).optional().default(5),
  gachaAcRewardMax: z.number().int().min(0).max(1000).optional().default(10),
  gachaPacRewardMin: z.number().int().min(0).max(1000).optional().default(0),
  gachaPacRewardMax: z.number().int().min(0).max(1000).optional().default(5),
  specialGachaCardId: z.string().min(1).nullable().optional().default(null),
  specialGachaDropRate: z.number().min(0).max(100).optional().default(0),
  rankPointsEnabled: z.boolean().optional().default(false),
  password: z.string().trim().max(128).optional(),
  removePassword: z.boolean().optional().default(false),
  problemIds: z.array(z.string().min(1)),
  problemCustomTitles: z.record(z.string(), z.string()).optional(),
  problemJudgeTypes: z.record(z.string(), z.enum(["STANDARD", "HEURISTIC", "INTERACTIVE"])).optional(),
  problemIoModes: z.record(z.string(), z.enum(["STDIO", "FILE"])).optional(),
  problemInputFiles: z.record(z.string(), z.string()).optional(),
  problemOutputFiles: z.record(z.string(), z.string()).optional(),
  newProblems: z.array(
    z.object({
      slug: z.string().trim().toLowerCase().min(2).max(64).regex(/^[a-z0-9-]+$/),
      title: z.string().trim().min(2).max(120),
      statement: z.string().trim().min(10),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
      timeLimitMs: z.number().int().positive(),
      memoryLimitMb: z.number().int().positive(),
      judgeType: z.enum(["STANDARD", "HEURISTIC", "INTERACTIVE"]).optional().default("STANDARD"),
      interactorSource: z.string().max(64_000).nullable().optional(),
      scoringMode: z.enum(SCORING_MODES).optional().default("ICPC"),
      ioMode: z.enum(["STDIO", "FILE"]).optional().default("STDIO"),
      inputFile: z.string().trim().max(100).nullable().optional(),
      outputFile: z.string().trim().max(100).nullable().optional(),
      testCases: z.array(
        z.object({
          input: z.string(),
          output: z.string(),
          isSample: z.boolean(),
          points: z.number().int().min(0),
        }),
      ).min(1),
    }),
  ).default([]),
}).superRefine((data, context) => {
  data.newProblems.forEach((problem, index) => {
    if (problem.judgeType === "INTERACTIVE" && !problem.interactorSource?.trim()) {
      context.addIssue({ code: "custom", path: ["newProblems", index, "interactorSource"], message: "Bài Interactive cần mã interactor C++." });
    }
    if (problem.judgeType === "INTERACTIVE" && problem.ioMode !== "STDIO") {
      context.addIssue({ code: "custom", path: ["newProblems", index, "ioMode"], message: "Bài Interactive chỉ hỗ trợ stdin/stdout." });
    }
    if (problem.judgeType === "INTERACTIVE" && problem.testCases.length > 20) {
      context.addIssue({ code: "custom", path: ["newProblems", index, "testCases"], message: "Bài Interactive hỗ trợ tối đa 20 test." });
    }
  });
  if (data.gachaAcRewardMin > data.gachaAcRewardMax) context.addIssue({ code: "custom", path: ["gachaAcRewardMax"], message: "Lượt tối đa khi AC phải lớn hơn hoặc bằng lượt tối thiểu." });
  if (data.gachaPacRewardMin > data.gachaPacRewardMax) context.addIssue({ code: "custom", path: ["gachaPacRewardMax"], message: "Lượt tối đa khi PAC phải lớn hơn hoặc bằng lượt tối thiểu." });
  if (data.specialGachaDropRate > 0 && !data.specialGachaCardId) context.addIssue({ code: "custom", path: ["specialGachaCardId"], message: "Chọn thẻ đặc biệt khi đặt xác suất rơi." });
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !canManageContests(user.role)) {
    return NextResponse.json({ error: "Không có quyền chỉnh sửa contest." }, { status: 403 });
  }

  const { id } = await context.params;
  const existingContest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      problems: {
        include: {
          problem: {
            select: { id: true, contestOnly: true },
          },
        },
      },
    },
  });

  if (!existingContest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  if (user.role !== "ADMIN" && existingContest.authorId !== user.id) {
    return NextResponse.json({ error: "Bạn chỉ có thể chỉnh sửa contest do mình tạo." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateContestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu contest không hợp lệ." }, { status: 400 });
  }
  if (parsed.data.specialGachaCardId) {
    const card = await prisma.gachaCard.findFirst({
      where: { id: parsed.data.specialGachaCardId, specialOnly: true, category: "DISPLAY" },
      select: { id: true },
    });
    if (!card) return NextResponse.json({ error: "Không tìm thấy thẻ đặc biệt đã chọn." }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (!(startAt < endAt)) {
    return NextResponse.json({ error: "Thời gian kết thúc phải sau lúc bắt đầu." }, { status: 400 });
  }

  if (new Set(parsed.data.problemIds).size !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Không được chọn trùng bài." }, { status: 400 });
  }

  if (parsed.data.password && parsed.data.removePassword) {
    return NextResponse.json({ error: "Không thể đặt và gỡ mật khẩu cùng lúc." }, { status: 400 });
  }
  const passwordHash = parsed.data.removePassword
    ? null
    : parsed.data.password
      ? await hashContestPassword(parsed.data.password)
      : existingContest.passwordHash;

  const newProblemSlugs = parsed.data.newProblems.map((problem) => problem.slug);
  if (new Set(newProblemSlugs).size !== newProblemSlugs.length) {
    return NextResponse.json({ error: "Slug bài mới trong contest không được trùng nhau." }, { status: 400 });
  }

  if (parsed.data.problemIds.length + parsed.data.newProblems.length === 0) {
    return NextResponse.json({ error: "Contest cần có ít nhất một bài." }, { status: 400 });
  }

  // Check duplicate slug if slug was changed
  if (parsed.data.slug !== existingContest.slug) {
    const slugExists = await prisma.contest.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (slugExists) {
      return NextResponse.json({ error: "Slug contest đã được sử dụng bởi kỳ thi khác." }, { status: 409 });
    }
  }

  // Check conflicting slugs for newly added problems
  if (newProblemSlugs.length > 0) {
    const conflictingProblems = await prisma.problem.findMany({
      where: { slug: { in: newProblemSlugs } },
      select: { slug: true },
    });
    if (conflictingProblems.length > 0) {
      return NextResponse.json(
        { error: `Slug bài đã tồn tại: ${conflictingProblems.map((p) => p.slug).join(", ")}.` },
        { status: 409 },
      );
    }
  }

  // Verify chosen problemIds exist (either published or already in this contest)
  const validProblems = await prisma.problem.findMany({
    where: {
      id: { in: parsed.data.problemIds },
      OR: [
        { published: true, contestOnly: false },
        { id: { in: existingContest.problems.map((p) => p.problemId) } },
      ],
    },
    select: { id: true, judgeType: true, ioMode: true, interactorSource: true },
  });

  if (validProblems.length !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Một hoặc nhiều bài đã chọn không còn khả dụng." }, { status: 400 });
  }
  for (const problem of validProblems) {
    const judgeType = problem.judgeType === "INTERACTIVE"
      ? "INTERACTIVE"
      : parsed.data.problemJudgeTypes?.[problem.id];
    if (judgeType === "INTERACTIVE" && (!problem.interactorSource?.trim() || problem.ioMode === "FILE")) {
      return NextResponse.json(
        { error: "Bài Interactive được chọn phải có interactor và dùng stdin/stdout." },
        { status: 400 },
      );
    }
    if (judgeType === "INTERACTIVE" && parsed.data.problemIoModes?.[problem.id] === "FILE") {
      return NextResponse.json({ error: "Bài Interactive chỉ hỗ trợ stdin/stdout." }, { status: 400 });
    }
  }

  const updatedContest = await prisma.$transaction(async (tx) => {
    // 1. Create newly added problems
    const createdNewProblemIds: string[] = [];
    for (const prob of parsed.data.newProblems) {
      const ioMode = prob.judgeType === "INTERACTIVE" ? "STDIO" : prob.ioMode ?? "STDIO";
      const created = await tx.problem.create({
        data: {
          ...prob,
          ioMode,
          interactorSource: prob.judgeType === "INTERACTIVE" ? prob.interactorSource?.trim() : null,
          inputFile: ioMode === "FILE" ? (prob.inputFile || `${prob.slug.toUpperCase()}.INP`) : null,
          outputFile: ioMode === "FILE" ? (prob.outputFile || `${prob.slug.toUpperCase()}.OUT`) : null,
          published: true,
          contestOnly: true,
          authorId: user.id,
          testCases: {
            create: prob.testCases.map((tc, order) => ({
              ...tc,
              order,
            })),
          },
        },
        select: { id: true },
      });
      createdNewProblemIds.push(created.id);
    }

    const allFinalProblemIds = [...parsed.data.problemIds, ...createdNewProblemIds];

    // 2. Remove old ContestProblem relations that are no longer selected
    await tx.contestProblem.deleteMany({
      where: {
        contestId: existingContest.id,
        problemId: { notIn: allFinalProblemIds },
      },
    });

    // 3. Upsert / update ContestProblem letters, customTitle and points
    const customTitles = parsed.data.problemCustomTitles ?? {};
    const problemJudgeTypes = parsed.data.problemJudgeTypes ?? {};
    const judgeTypeByProblemId = new Map(validProblems.map((problem) => [problem.id, problem.judgeType]));
    const problemIoModes = parsed.data.problemIoModes ?? {};
    const problemInputFiles = parsed.data.problemInputFiles ?? {};
    const problemOutputFiles = parsed.data.problemOutputFiles ?? {};

    for (let i = 0; i < allFinalProblemIds.length; i++) {
      const problemId = allFinalProblemIds[i];
      const letter = String.fromCharCode(65 + i);
      const customTitle = customTitles[problemId]?.trim() || null;
      const judgeType = judgeTypeByProblemId.get(problemId) === "INTERACTIVE"
        ? "INTERACTIVE"
        : problemJudgeTypes[problemId] || null;
      const ioMode = judgeType === "INTERACTIVE" ? "STDIO" : problemIoModes[problemId] || null;
      const inputFile = problemInputFiles[problemId]?.trim() || null;
      const outputFile = problemOutputFiles[problemId]?.trim() || null;
      await tx.contestProblem.upsert({
        where: { contestId_problemId: { contestId: existingContest.id, problemId } },
        update: { letter, customTitle, judgeType, ioMode, inputFile, outputFile, points: 100 },
        create: {
          contestId: existingContest.id,
          problemId,
          letter,
          customTitle,
          judgeType,
          ioMode,
          inputFile,
          outputFile,
          points: 100,
        },
      });
    }

    // 4. Update contest details
    const contest = await tx.contest.update({
      where: { id: existingContest.id },
      data: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        startAt,
        endAt,
        testLimit: parsed.data.testLimit,
        scoringMode: parsed.data.scoringMode,
        gachaAcRewardMin: parsed.data.gachaAcRewardMin,
        gachaAcRewardMax: parsed.data.gachaAcRewardMax,
        gachaPacRewardMin: parsed.data.gachaPacRewardMin,
        gachaPacRewardMax: parsed.data.gachaPacRewardMax,
        specialGachaCardId: parsed.data.specialGachaCardId,
        specialGachaDropRate: parsed.data.specialGachaDropRate,
        rankPointsEnabled: parsed.data.rankPointsEnabled,
        passwordHash,
      },
    });

    return contest;
  });

  return NextResponse.json({ id: updatedContest.id, slug: updatedContest.slug });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action !== "register") {
    return NextResponse.json({ error: "Hành động không hỗ trợ." }, { status: 400 });
  }

  await prisma.contestRegistration.upsert({
    where: {
      contestId_userId: { contestId: contest.id, userId: user.id },
    },
    update: {},
    create: { contestId: contest.id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
