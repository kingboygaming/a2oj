import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canPublish, getCurrentUser } from "@/lib/auth";

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
      _count: { select: { submissions: true } },
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
  inputFile: z.string().trim().max(100).nullable().optional(),
  outputFile: z.string().trim().max(100).nullable().optional(),
  testCases: z.array(testSchema).min(1),
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
      judgeType: parsed.data.judgeType ?? "STANDARD",
      inputFile: parsed.data.ioMode === "FILE" ? (parsed.data.inputFile || `${parsed.data.slug.toUpperCase()}.INP`) : null,
      outputFile: parsed.data.ioMode === "FILE" ? (parsed.data.outputFile || `${parsed.data.slug.toUpperCase()}.OUT`) : null,
      published: canPublish(user.role),
      authorId: user.id,
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
