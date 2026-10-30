import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await prisma.news.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Không tìm thấy tin đã đăng." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
