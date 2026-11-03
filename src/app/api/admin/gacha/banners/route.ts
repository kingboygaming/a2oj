import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bannerSchema = z.object({
  slug: z.string().trim()
    .min(2, "Slug banner cần ít nhất 2 ký tự.")
    .max(80, "Slug banner tối đa 80 ký tự.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang."),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(""),
  type: z.enum(["NORMAL", "LIMITED"]),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  cards: z.array(z.object({
    cardId: z.string().min(1),
    dropRate: z.number().min(0.01).max(100),
  })).min(1).max(20),
}).superRefine((data, context) => {
  const totalRate = data.cards.reduce((sum, card) => sum + card.dropRate, 0);
  if (Math.round(totalRate * 100) !== 10_000) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Tổng tỉ lệ rơi thẻ trong banner phải bằng 100%." });
  }
  if (data.cards.some((card) => Math.abs(card.dropRate * 100 - Math.round(card.dropRate * 100)) > 1e-8)) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Tỉ lệ mỗi thẻ chỉ được có tối đa 2 chữ số thập phân." });
  }
  if (new Set(data.cards.map((card) => card.cardId)).size !== data.cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Không được chọn trùng thẻ trong banner." });
  }
  if (data.type === "LIMITED" && (!data.startsAt || !data.endsAt)) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Banner giới hạn cần có thời gian bắt đầu và kết thúc." });
  }
  if (data.type === "LIMITED" && data.startsAt && data.endsAt && new Date(data.startsAt) >= new Date(data.endsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Thời điểm kết thúc phải sau thời điểm bắt đầu." });
  }
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });

  const parsed = bannerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu banner không hợp lệ." }, { status: 400 });

  const selectedCards = await prisma.gachaCard.findMany({
    where: { id: { in: parsed.data.cards.map((card) => card.cardId) }, specialOnly: false, category: "DISPLAY" },
    select: { id: true },
  });
  if (selectedCards.length !== parsed.data.cards.length) {
    return NextResponse.json({ error: "Một hoặc nhiều thẻ banner không tồn tại hoặc là thẻ đặc biệt." }, { status: 400 });
  }

  try {
    const banner = await prisma.$transaction(async (transaction) => {
      const created = await transaction.gachaBanner.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          description: parsed.data.description,
          type: parsed.data.type,
          startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
          endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        },
      });
      await transaction.gachaBannerCard.createMany({
        data: parsed.data.cards.map((card) => ({ bannerId: created.id, cardId: card.cardId, dropRate: card.dropRate })),
      });
      return created;
    });
    return NextResponse.json({ success: true, banner }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Slug banner hoặc thẻ đã được sử dụng." }, { status: 409 });
    }
    throw error;
  }
}
