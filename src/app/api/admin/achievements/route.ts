import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENT_COLOR_CLASSES, ACHIEVEMENT_RARITIES, ACHIEVEMENT_TRIGGERS } from "@/lib/rank-colors";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  icon: z.string().trim().min(1).max(12),
  rarity: z.enum(ACHIEVEMENT_RARITIES),
  secret: z.boolean(),
  triggerType: z.enum(ACHIEVEMENT_TRIGGERS),
  threshold: z.number().int().min(-1000000).max(1000000),
  problemSlug: z.string().trim().max(100).optional().nullable(),
  nameColorEnabled: z.boolean(),
  nameColor: z.string().nullable().optional(),
}).superRefine((data, context) => {
  if (data.triggerType !== "RANK_POINTS" && data.threshold < 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["threshold"], message: "Ngưỡng phải ít nhất là 1." });
  }
  if (data.triggerType === "HEURISTIC_SCORE" && data.threshold > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["threshold"], message: "Ngưỡng heuristic phải từ 1 đến 100%." });
  }
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin thành tựu không hợp lệ." }, { status: 400 });
  const data = parsed.data;
  if (data.nameColorEnabled && (!data.nameColor || !ACHIEVEMENT_COLOR_CLASSES[data.nameColor])) {
    return NextResponse.json({ error: "Hãy chọn màu tên hợp lệ." }, { status: 400 });
  }
  if ((data.triggerType === "PROBLEM_AC" || data.triggerType === "HEURISTIC_SCORE") && data.problemSlug) {
    const problem = await prisma.problem.findUnique({ where: { slug: data.problemSlug }, select: { judgeType: true } });
    if (!problem) return NextResponse.json({ error: "Không tìm thấy problem theo slug." }, { status: 400 });
    if (data.triggerType === "HEURISTIC_SCORE" && problem.judgeType !== "HEURISTIC") return NextResponse.json({ error: "Problem này không dùng máy chấm heuristic." }, { status: 400 });
  } else if (data.triggerType === "PROBLEM_AC") {
    return NextResponse.json({ error: "Thành tựu AC bài cụ thể cần có slug bài." }, { status: 400 });
  }
  try {
    const achievement = await prisma.achievement.create({ data: { ...data, secret: data.secret || data.rarity === "SECRET", problemSlug: data.problemSlug || null, nameColor: data.nameColorEnabled ? data.nameColor : null } });
    return NextResponse.json({ success: true, achievement });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Slug này đã được dùng." }, { status: 409 });
    throw error;
  }
}
