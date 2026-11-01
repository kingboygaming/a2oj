import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { hashContestPassword } from "@/lib/contest-password";

export async function GET() {
  const contests = await prisma.contest.findMany({
    orderBy: { startAt: "desc" },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { registrations: true, problems: true } },
    },
  });
  return NextResponse.json(contests.map(({ passwordHash: _passwordHash, ...contest }) => contest));
}

const schema = z.object({
  slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  testLimit: z.number().int().min(0).max(100).default(5),
  rankPointsEnabled: z.boolean().optional().default(false),
  password: z.string().trim().max(128).optional(),
  problemIds: z.array(z.string().min(1)),
  problemCustomTitles: z.record(z.string(), z.string()).optional(),
  problemJudgeTypes: z.record(z.string(), z.enum(["STANDARD", "HEURISTIC"])).optional(),
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
      judgeType: z.enum(["STANDARD", "HEURISTIC"]).optional().default("STANDARD"),
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
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageContests(user.role)) {
    return NextResponse.json({ error: "Chỉ giáo viên được tạo contest." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu contest không hợp lệ." }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (!(startAt < endAt)) {
    return NextResponse.json({ error: "Thời gian kết thúc phải sau lúc bắt đầu." }, { status: 400 });
  }

  if (new Set(parsed.data.problemIds).size !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Không được chọn trùng bài." }, { status: 400 });
  }
  const newProblemSlugs = parsed.data.newProblems.map((problem) => problem.slug);
  if (new Set(newProblemSlugs).size !== newProblemSlugs.length) {
    return NextResponse.json({ error: "Slug bài mới trong contest không được trùng nhau." }, { status: 400 });
  }
  if (parsed.data.problemIds.length + parsed.data.newProblems.length === 0) {
    return NextResponse.json({ error: "Contest cần có ít nhất một bài." }, { status: 400 });
  }

  const [existingContest, selectedProblems, conflictingProblems] = await Promise.all([
    prisma.contest.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } }),
    prisma.problem.findMany({
      where: {
        id: { in: parsed.data.problemIds },
        published: true,
        contestOnly: false,
      },
      select: { id: true },
    }),
    prisma.problem.findMany({
      where: { slug: { in: newProblemSlugs } },
      select: { id: true, slug: true },
    }),
  ]);
  if (existingContest) {
    return NextResponse.json({ error: "Slug contest đã tồn tại." }, { status: 409 });
  }
  if (selectedProblems.length !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Một hoặc nhiều bài đã chọn không còn khả dụng." }, { status: 400 });
  }
  if (conflictingProblems.length > 0) {
    return NextResponse.json(
      { error: `Slug bài đã tồn tại: ${conflictingProblems.map((problem) => problem.slug).join(", ")}.` },
      { status: 409 },
    );
  }

  const passwordHash = parsed.data.password
    ? await hashContestPassword(parsed.data.password)
    : null;

  const contest = await prisma.$transaction(async (transaction) => {
    const createdContest = await transaction.contest.create({
      data: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        startAt,
        endAt,
        testLimit: parsed.data.testLimit,
        rankPointsEnabled: parsed.data.rankPointsEnabled,
        passwordHash,
        authorId: user.id,
      },
    });

    const newProblemIds: string[] = [];
    for (const problem of parsed.data.newProblems) {
      const ioMode = problem.ioMode ?? "STDIO";
      const createdProblem = await transaction.problem.create({
        data: {
          ...problem,
          ioMode,
          inputFile: ioMode === "FILE" ? (problem.inputFile || `${problem.slug.toUpperCase()}.INP`) : null,
          outputFile: ioMode === "FILE" ? (problem.outputFile || `${problem.slug.toUpperCase()}.OUT`) : null,
          published: true,
          contestOnly: true,
          authorId: user.id,
          testCases: {
            create: problem.testCases.map((testCase, order) => ({
              ...testCase,
              order,
            })),
          },
        },
        select: { id: true },
      });
      newProblemIds.push(createdProblem.id);
    }

    const problemIds = [...parsed.data.problemIds, ...newProblemIds];
    const customTitles = parsed.data.problemCustomTitles ?? {};
    const problemJudgeTypes = parsed.data.problemJudgeTypes ?? {};
    const problemIoModes = parsed.data.problemIoModes ?? {};
    const problemInputFiles = parsed.data.problemInputFiles ?? {};
    const problemOutputFiles = parsed.data.problemOutputFiles ?? {};

    await transaction.contestProblem.createMany({
      data: problemIds.map((problemId, index) => ({
        contestId: createdContest.id,
        problemId,
        letter: String.fromCharCode(65 + index),
        customTitle: customTitles[problemId]?.trim() || null,
        judgeType: problemJudgeTypes[problemId] || null,
        ioMode: problemIoModes[problemId] || null,
        inputFile: problemInputFiles[problemId]?.trim() || null,
        outputFile: problemOutputFiles[problemId]?.trim() || null,
        points: 100,
      })),
    });

    return createdContest;
  });

  return NextResponse.json({ id: contest.id, slug: parsed.data.slug }, { status: 201 });
}
