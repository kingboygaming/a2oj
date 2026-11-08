import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canPublish, getCurrentUser } from "@/lib/auth";
import { SCORING_MODES } from "@/lib/scoring";
import { verifyProblemPdf } from "@/lib/problem-statement-pdf";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const user = await getCurrentUser();

  const problems = await prisma.problem.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { title: { contains: q } },
                { slug: { contains: q } },
              ],
            }
          : {},
        user?.role === "TEACHER" || user?.role === "ADMIN"
          ? { contestOnly: false }
          : { published: true, contestOnly: false },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { submissions: { where: { contestId: null } } } },
    },
  });

  return NextResponse.json(problems);
}

const testSchema = z.object({
  input: z.string(),
  output: z.string(),
  isSample: z.boolean().optional(),
  points: z.number().int().min(0).optional(),
});

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(120),
  statement: z.string().min(10),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  timeLimitMs: z.number().int().positive().optional(),
  memoryLimitMb: z.number().int().positive().optional(),
  ioMode: z.enum(["STDIO", "FILE"]).optional().default("STDIO"),
  judgeType: z.enum(["STANDARD", "HEURISTIC"]).optional().default("STANDARD"),
  scoringMode: z.enum(SCORING_MODES).optional().default("ICPC"),
  gachaAcRewardMin: z.number().int().min(0).max(1000).optional().default(5),
  gachaAcRewardMax: z.number().int().min(0).max(1000).optional().default(10),
  gachaPacRewardMin: z.number().int().min(0).max(1000).optional().default(0),
  gachaPacRewardMax: z.number().int().min(0).max(1000).optional().default(5),
  specialGachaCardId: z.string().min(1).nullable().optional().default(null),
  specialGachaDropRate: z.number().min(0).max(100).optional().default(0),
  heuristicTolerancePercent: z.number().int().min(0).max(100).optional().default(5),
  achievementBadgeTitle: z.string().trim().max(80).nullable().optional(),
  achievementBadgeDescription: z.string().trim().max(180).nullable().optional(),
  achievementScoreThreshold: z.number().int().min(1).max(10000).nullable().optional(),
  inputFile: z.string().trim().max(100).nullable().optional(),
  outputFile: z.string().trim().max(100).nullable().optional(),
  statementPdfPath: z.string().max(300).nullable().optional(),
  testCases: z.array(testSchema).min(1),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(32)).max(10).optional().default([]).transform((tags) => [...new Set(tags)]),
}).superRefine((data, context) => {
  if (data.gachaAcRewardMin > data.gachaAcRewardMax) context.addIssue({ code: "custom", path: ["gachaAcRewardMax"], message: "Lượt tối đa khi AC phải lớn hơn hoặc bằng lượt tối thiểu." });
  if (data.gachaPacRewardMin > data.gachaPacRewardMax) context.addIssue({ code: "custom", path: ["gachaPacRewardMax"], message: "Lượt tối đa khi PAC phải lớn hơn hoặc bằng lượt tối thiểu." });
  if (data.specialGachaDropRate > 0 && !data.specialGachaCardId) context.addIssue({ code: "custom", path: ["specialGachaCardId"], message: "Chọn thẻ đặc biệt khi đặt xác suất rơi." });
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đề bài không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.statementPdfPath) {
    try {
      await verifyProblemPdf(parsed.data.statementPdfPath, user.id);
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Không thể xác minh PDF đề bài.",
      }, { status: 400 });
    }
  }
  if (parsed.data.specialGachaCardId) {
    const card = await prisma.gachaCard.findFirst({
      where: { id: parsed.data.specialGachaCardId, specialOnly: true, category: "DISPLAY" },
      select: { id: true },
    });
    if (!card) return NextResponse.json({ error: "Không tìm thấy thẻ đặc biệt đã chọn." }, { status: 400 });
  }

  const exists = await prisma.problem.findUnique({ where: { slug: parsed.data.slug } });
  if (exists) {
    return NextResponse.json({ error: "Slug đã tồn tại." }, { status: 409 });
  }

  const problem = await prisma.problem.create({
    data: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      statement: parsed.data.statement,
      difficulty: parsed.data.difficulty ?? "EASY",
      timeLimitMs: parsed.data.timeLimitMs ?? 1000,
      memoryLimitMb: parsed.data.memoryLimitMb ?? 256,
      ioMode: parsed.data.ioMode ?? "STDIO",
      statementPdfPath: parsed.data.statementPdfPath ?? null,
      judgeType: parsed.data.judgeType ?? "STANDARD",
      scoringMode: parsed.data.scoringMode,
      gachaAcRewardMin: parsed.data.gachaAcRewardMin,
      gachaAcRewardMax: parsed.data.gachaAcRewardMax,
      gachaPacRewardMin: parsed.data.gachaPacRewardMin,
      gachaPacRewardMax: parsed.data.gachaPacRewardMax,
      specialGachaCardId: parsed.data.specialGachaCardId,
      specialGachaDropRate: parsed.data.specialGachaDropRate,
      heuristicTolerancePercent: parsed.data.heuristicTolerancePercent ?? 5,
      achievementBadgeTitle: parsed.data.judgeType === "HEURISTIC" ? parsed.data.achievementBadgeTitle || null : null,
      achievementBadgeDescription: parsed.data.judgeType === "HEURISTIC" && parsed.data.achievementBadgeTitle ? parsed.data.achievementBadgeDescription || null : null,
      achievementScoreThreshold: parsed.data.judgeType === "HEURISTIC" && parsed.data.achievementBadgeTitle ? parsed.data.achievementScoreThreshold ?? 90 : null,
      inputFile: parsed.data.ioMode === "FILE" ? (parsed.data.inputFile || `${parsed.data.slug.toUpperCase()}.INP`) : null,
      outputFile: parsed.data.ioMode === "FILE" ? (parsed.data.outputFile || `${parsed.data.slug.toUpperCase()}.OUT`) : null,
      published: canPublish(user.role),
      authorId: user.id,
      tags: { connectOrCreate: parsed.data.tags.map((name) => ({ where: { name }, create: { name } })) },
      testCases: {
        create: parsed.data.testCases.map((t, i) => ({
          input: t.input,
          output: t.output,
          isSample: t.isSample ?? false,
          points: t.points ?? (t.isSample ? 0 : 100),
          order: i,
        })),
      },
    },
  });

  return NextResponse.json(problem, { status: 201 });
}
