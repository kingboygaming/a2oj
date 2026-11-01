import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserRankSummary } from "@/lib/ranks";
import { prisma } from "@/lib/prisma";

const schema = z.object({ mode: z.enum(["RANK", "ACHIEVEMENT"]), achievementId: z.string().optional().nullable() });

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lựa chọn màu tên không hợp lệ." }, { status: 400 });
  if (parsed.data.mode === "RANK") {
    await prisma.user.update({ where: { id: user.id }, data: { nameColorMode: "RANK", nameColorAchievementId: null } });
    return NextResponse.json({ success: true });
  }
  if (!parsed.data.achievementId) return NextResponse.json({ error: "Hãy chọn thành tựu có màu tên." }, { status: 400 });
  const summary = await getUserRankSummary(user.id);
  const eligible = summary.badges.some((badge) => badge.achievementId === parsed.data.achievementId && badge.earned && badge.nameColorEnabled);
  if (!eligible) return NextResponse.json({ error: "Bạn chưa mở khóa màu tên từ thành tựu này." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { nameColorMode: "ACHIEVEMENT", nameColorAchievementId: parsed.data.achievementId } });
  return NextResponse.json({ success: true });
}
