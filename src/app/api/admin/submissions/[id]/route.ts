import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({ where: { id }, select: { id: true } });
  if (!submission) return NextResponse.json({ error: "Không tìm thấy bài nộp." }, { status: 404 });

  await prisma.submission.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
