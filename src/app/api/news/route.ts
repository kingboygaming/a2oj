import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createNewsSchema = z.object({
  title: z.string().trim().min(2, "Tiêu đề cần ít nhất 2 ký tự.").max(160),
  body: z.string().trim().min(1, "Nội dung tin không được để trống.").max(10000),
  pinned: z.boolean().optional(),
});

export async function GET() {
  const news = await prisma.news.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { displayName: true } } },
    take: 20,
  });
  return NextResponse.json(news);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được đăng tin." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createNewsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nội dung tin không hợp lệ." },
      { status: 400 },
    );
  }

  const news = await prisma.news.create({
    data: {
      ...parsed.data,
      authorId: user.id,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: news.id }, { status: 201 });
}
