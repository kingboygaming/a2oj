import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCORING_MODES } from "@/lib/scoring";

const updateSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("problem"),
    problemId: z.string().min(1),
    scoringMode: z.enum(SCORING_MODES),
  }),
  z.object({
    scope: z.literal("all"),
    scoringMode: z.enum(SCORING_MODES),
  }),
]);

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu chế độ chấm không hợp lệ." }, { status: 400 });
  }

  if (parsed.data.scope === "problem") {
    const result = await prisma.problem.updateMany({
      where: { id: parsed.data.problemId, contestOnly: false },
      data: { scoringMode: parsed.data.scoringMode },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
    }
    return NextResponse.json({ updated: result.count });
  }

  const result = await prisma.problem.updateMany({
    where: { contestOnly: false },
    data: { scoringMode: parsed.data.scoringMode },
  });
  return NextResponse.json({ updated: result.count });
}
