import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoadmapTrack } from "@/lib/roadmap-progress";
import { roadmapDescendantIds } from "@/lib/roadmap-tree";

const schema = z.object({
  sortOrder: z.coerce.number().int().min(1).max(999),
  parentId: z.string().trim().min(1).nullable(),
  level: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(5).max(500),
  topics: z.array(z.string().trim().min(2).max(160)).min(1).max(15),
  content: z.string().trim().min(20).max(30000),
  checkpoint: z.string().trim().min(5).max(500),
  resources: z.array(z.object({
    label: z.string().trim().min(2).max(120),
    href: z.string().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  })).max(10),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được quản lý lộ trình." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin chặng học chưa hợp lệ." }, { status: 400 });
  }

  if (parsed.data.parentId) {
    const stages = await prisma.roadmapStage.findMany({ select: { id: true, parentId: true, sortOrder: true, createdAt: true } });
    const parent = await prisma.roadmapStage.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, parentId: true, level: true },
    });
    const [currentStage, childStages] = await Promise.all([
      prisma.roadmapStage.findUnique({
        where: { id },
        select: { id: true, parentId: true },
      }),
      prisma.roadmapStage.findMany({ where: { parentId: id }, select: { id: true } }),
    ]);
    if (!currentStage) {
      return NextResponse.json({ error: "Không tìm thấy chặng học." }, { status: 404 });
    }
    if (parsed.data.parentId === id || roadmapDescendantIds(stages, id).has(parsed.data.parentId)) {
      return NextResponse.json({ error: "Không thể chọn chính chặng này hoặc nhánh con làm chặng cha." }, { status: 400 });
    }
    if (!parent || parent.parentId) {
      return NextResponse.json({ error: "Chỉ có thể chọn một chặng lớn làm chặng cha." }, { status: 400 });
    }
    if (getRoadmapTrack(parent.level) !== getRoadmapTrack(parsed.data.level)) {
      return NextResponse.json({ error: "Nhánh con phải thuộc cùng cấp độ với chặng lớn." }, { status: 400 });
    }
    if (currentStage.parentId === null && childStages.length > 0) {
      return NextResponse.json({ error: "Hãy chuyển các nhánh con trước khi biến chặng lớn thành nhánh con." }, { status: 400 });
    }
  }

  const currentStage = await prisma.roadmapStage.findUnique({
    where: { id },
    select: { parentId: true },
  });
  if (!currentStage) {
    return NextResponse.json({ error: "Không tìm thấy chặng học." }, { status: 404 });
  }
  if (currentStage.parentId === null) {
    const children = await prisma.roadmapStage.findMany({ where: { parentId: id }, select: { level: true } });
    if (children.some((child) => getRoadmapTrack(child.level) !== getRoadmapTrack(parsed.data.level))) {
      return NextResponse.json({ error: "Chặng lớn phải giữ cùng cấp độ với các nhánh con." }, { status: 400 });
    }
  }

  const result = await prisma.roadmapStage.updateMany({
    where: { id },
    data: {
      ...parsed.data,
      topics: JSON.stringify(parsed.data.topics),
      resources: JSON.stringify(parsed.data.resources),
    },
  });
  if (!result.count) {
    return NextResponse.json({ error: "Không tìm thấy chặng học." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được quản lý lộ trình." }, { status: 403 });
  }

  const { id } = await params;
  const result = await prisma.roadmapStage.deleteMany({ where: { id } });
  if (!result.count) {
    return NextResponse.json({ error: "Không tìm thấy chặng học." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
