import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.union([
  z.object({ active: z.boolean() }),
  z.object({
    cards: z.array(z.object({
      cardId: z.string().min(1),
      dropRate: z.number().min(0.0001).max(100),
    })).min(1).max(20),
  }).superRefine((data, context) => {
    const totalRate = data.cards.reduce((sum, card) => sum + card.dropRate, 0);
    if (Math.round(totalRate * 10_000) !== 1_000_000) {
      context.addIssue({ code: "custom", path: ["cards"], message: "Tổng tỉ lệ thẻ trong banner phải bằng đúng 100%." });
    }
    if (data.cards.some((card) => Math.abs(card.dropRate * 10_000 - Math.round(card.dropRate * 10_000)) > 1e-6)) {
      context.addIssue({ code: "custom", path: ["cards"], message: "Tỉ lệ mỗi thẻ chỉ được có tối đa 4 chữ số thập phân." });
    }
    if (new Set(data.cards.map((card) => card.cardId)).size !== data.cards.length) {
      context.addIssue({ code: "custom", path: ["cards"], message: "Không được chọn trùng thẻ trong banner." });
    }
  }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu cập nhật banner không hợp lệ." }, { status: 400 });
  }

  if (!("cards" in parsed.data)) {
    const updated = await prisma.gachaBanner.updateMany({ where: { id }, data: { active: parsed.data.active } });
    if (!updated.count) return NextResponse.json({ error: "Không tìm thấy banner." }, { status: 404 });
    return NextResponse.json({ success: true });
  }
  const cards = parsed.data.cards;
  const banner = await prisma.gachaBanner.findUnique({ where: { id }, select: { id: true } });
  if (!banner) return NextResponse.json({ error: "Không tìm thấy banner." }, { status: 404 });
  const selectedCards = await prisma.gachaCard.findMany({
    where: {
      id: { in: cards.map((card) => card.cardId) },
      OR: [
        { category: "BATTLE" },
        { category: "DISPLAY", specialOnly: false },
      ],
    },
    select: { id: true },
  });
  if (selectedCards.length !== cards.length) {
    return NextResponse.json({ error: "Một hoặc nhiều thẻ không tồn tại hoặc không thể đưa vào banner." }, { status: 400 });
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.gachaBannerCard.deleteMany({ where: { bannerId: id } });
    await transaction.gachaBannerCard.createMany({
      data: cards.map((card) => ({ bannerId: id, cardId: card.cardId, dropRate: card.dropRate })),
    });
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  const { id } = await context.params;
  const banner = await prisma.gachaBanner.findUnique({ where: { id }, select: { id: true } });
  if (!banner) return NextResponse.json({ error: "Không tìm thấy banner." }, { status: 404 });

  try {
    await prisma.$transaction(async (transaction) => {
      const pullCount = await transaction.gachaPull.count({ where: { bannerId: id } });
      if (pullCount > 0) throw new Error(`BANNER_HAS_PULLS:${pullCount}`);
      await transaction.gachaBanner.delete({ where: { id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BANNER_HAS_PULLS:")) {
      const pullCount = Number(error.message.slice("BANNER_HAS_PULLS:".length));
      return NextResponse.json({
        error: `Banner đã có ${pullCount} lượt quay nên không thể xóa để giữ lịch sử. Hãy tắt banner thay thế.`,
      }, { status: 409 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json({
        error: "Banner vừa phát sinh lượt quay nên không thể xóa. Hãy tắt banner thay thế.",
      }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
