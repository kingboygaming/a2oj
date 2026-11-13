import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("reschedule"),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }).superRefine((event, context) => {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    if (startsAt.getTime() <= Date.now()) {
      context.addIssue({ code: "custom", path: ["startsAt"], message: "Thời điểm bắt đầu phải ở tương lai." });
    }
    if (endsAt <= startsAt) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "Thời điểm kết thúc phải sau thời điểm bắt đầu." });
    }
    if (endsAt.getTime() - startsAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "Sự kiện không được kéo dài quá 30 ngày." });
    }
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Thao tác sự kiện không hợp lệ." },
      { status: 400 },
    );
  }

  const event = await prisma.worldEvent.findUnique({ where: { id } });
  if (!event || !event.slug.startsWith("custom-")) {
    return NextResponse.json({ error: "Không tìm thấy sự kiện quản trị được." }, { status: 404 });
  }
  if (event.status !== "SCHEDULED" || event.startsAt <= new Date()) {
    return NextResponse.json({ error: "Chỉ có thể thay đổi sự kiện chưa bắt đầu." }, { status: 409 });
  }

  if (parsed.data.action === "cancel") {
    const canceled = await prisma.$transaction(async (tx) => {
      const changed = await tx.worldEvent.updateMany({
        where: { id, status: "SCHEDULED", startsAt: { gt: new Date() } },
        data: { status: "CANCELED" },
      });
      if (!changed.count) return false;
      await tx.worldJob.updateMany({
        where: { eventId: id, status: { in: ["PENDING", "RUNNING"] } },
        data: { status: "CANCELED", lockedAt: null },
      });
      return true;
    });
    if (!canceled) {
      return NextResponse.json({ error: "Sự kiện vừa bắt đầu hoặc đã bị thay đổi." }, { status: 409 });
    }
    return NextResponse.json({ success: true, status: "CANCELED" });
  }

  const { startsAt, endsAt } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.worldEvent.updateMany({
      where: { id, status: "SCHEDULED", startsAt: { gt: new Date() } },
      data: { startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
    });
    if (!changed.count) return false;
    await tx.worldJob.updateMany({
      where: { eventId: id, status: "PENDING" },
      data: { runAt: new Date(endsAt) },
    });
    return true;
  });
  if (!updated) {
    return NextResponse.json({ error: "Sự kiện vừa bắt đầu hoặc đã bị thay đổi." }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
