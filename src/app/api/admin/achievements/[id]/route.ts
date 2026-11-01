import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  const { id } = await context.params;
  await prisma.$transaction([
    prisma.user.updateMany({ where: { nameColorAchievementId: id }, data: { nameColorMode: "RANK", nameColorAchievementId: null } }),
    prisma.achievementUnlock.deleteMany({ where: { achievementKey: `achievement-${id}` } }),
    prisma.achievement.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
}
