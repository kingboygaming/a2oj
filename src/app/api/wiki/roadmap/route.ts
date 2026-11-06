import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  sortOrder: z.coerce.number().int().min(1).max(999),
  level: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(5).max(500),
  topics: z.array(z.string().trim().min(2).max(160)).min(1).max(15),
  checkpoint: z.string().trim().min(5).max(500),
  resources: z.array(z.object({
    label: z.string().trim().min(2).max(120),
    href: z.string().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  })).max(10),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được quản lý lộ trình." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin chặng học chưa hợp lệ." }, { status: 400 });
  }

  const stage = await prisma.roadmapStage.create({
    data: {
      ...parsed.data,
      topics: JSON.stringify(parsed.data.topics),
      resources: JSON.stringify(parsed.data.resources),
    },
  });
  return NextResponse.json({ id: stage.id }, { status: 201 });
}
