import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageContests, getCurrentUser } from "@/lib/auth";

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
  return NextResponse.json(contest);
}

const updateContestSchema = z.object({
  slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  testLimit: z.number().int().min(0).max(100).default(5),
  problemIds: z.array(z.string().min(1)),
  newProblems: z.array(
    z.object({
      slug: z.string().trim().toLowerCase().min(2).max(64).regex(/^[a-z0-9-]+$/),
      title: z.string().trim().min(2).max(120),
      statement: z.string().trim().min(10),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
      timeLimitMs: z.number().int().positive(),
      memoryLimitMb: z.number().int().positive(),
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
    select: { id: true },
  });

  if (validProblems.length !== parsed.data.problemIds.length) {
    return NextResponse.json({ error: "Một hoặc nhiều bài đã chọn không còn khả dụng." }, { status: 400 });
  }

  const updatedContest = await prisma.$transaction(async (tx) => {
    // 1. Create newly added problems
    const createdNewProblemIds: string[] = [];
    for (const prob of parsed.data.newProblems) {
      const created = await tx.problem.create({
        data: {
          ...prob,
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

    // 3. Upsert / update ContestProblem letters and points
    for (let i = 0; i < allFinalProblemIds.length; i++) {
      const problemId = allFinalProblemIds[i];
      const letter = String.fromCharCode(65 + i);
      await tx.contestProblem.upsert({
        where: { contestId_problemId: { contestId: existingContest.id, problemId } },
        update: { letter, points: 100 },
        create: {
          contestId: existingContest.id,
          problemId,
          letter,
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
      },
    });

    return contest;
  });

  return NextResponse.json(updatedContest);
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
