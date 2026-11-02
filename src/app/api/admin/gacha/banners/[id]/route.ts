import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  const { id } = await context.params;
  const parsed = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái banner không hợp lệ." }, { status: 400 });
  const updated = await prisma.gachaBanner.updateMany({ where: { id }, data: { active: parsed.data.active } });
  if (!updated.count) return NextResponse.json({ error: "Không tìm thấy banner." }, { status: 404 });
  return NextResponse.json({ success: true });
}
