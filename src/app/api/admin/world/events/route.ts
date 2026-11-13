import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const eventSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(3).max(1_000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  participantLimit: z.number().int().min(1).max(10_000),
  minFactoryLevel: z.number().int().min(1).max(20),
  contributionWoodCost: z.number().int().min(1).max(10_000),
  contributionCooldownSeconds: z.number().int().min(1).max(3_600),
  firstRewardWood: z.number().int().min(0).max(100_000),
  firstRewardStone: z.number().int().min(0).max(100_000),
  secondRewardWood: z.number().int().min(0).max(100_000),
  secondRewardStone: z.number().int().min(0).max(100_000),
  thirdRewardWood: z.number().int().min(0).max(100_000),
  thirdRewardStone: z.number().int().min(0).max(100_000),
}).superRefine((event, context) => {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  const now = Date.now();
  if (startsAt.getTime() <= now) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Thời điểm bắt đầu phải ở tương lai." });
  }
  if (endsAt <= startsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Thời điểm kết thúc phải sau thời điểm bắt đầu." });
  }
  if (endsAt.getTime() - startsAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Sự kiện không được kéo dài quá 30 ngày." });
  }
  if (
    event.firstRewardWood + event.firstRewardStone === 0 &&
    event.secondRewardWood + event.secondRewardStone === 0 &&
    event.thirdRewardWood + event.thirdRewardStone === 0
  ) {
    context.addIssue({ code: "custom", path: ["firstRewardWood"], message: "Cần cấu hình ít nhất một phần thưởng." });
  }
});

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const events = await prisma.worldEvent.findMany({
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      _count: { select: { participants: true } },
      jobs: { select: { status: true, attempts: true, lastError: true } },
    },
  });
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Thông tin sự kiện không hợp lệ." },
      { status: 400 },
    );
  }

  const slug = `custom-${randomUUID()}`;
  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.worldEvent.create({
      data: {
        slug,
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
      },
    });
    await tx.worldJob.create({
      data: {
        uniqueKey: `settle:${slug}`,
        eventId: created.id,
        runAt: created.endsAt,
      },
    });
    return created;
  });

  return NextResponse.json({ success: true, event }, { status: 201 });
}
