import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { normalizeGachaCardData, parseGachaCardForm } from "@/lib/gacha-card-schema";
import { prisma } from "@/lib/prisma";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const parsed = parseGachaCardForm(formData);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin thẻ không hợp lệ." }, { status: 400 });
  }
  if (parsed.data.bugPart && parsed.data.category !== "BATTLE") {
    return NextResponse.json({ error: "Mảnh Compile Exodia chỉ dành cho thẻ chiến đấu." }, { status: 400 });
  }

  const image = formData.get("image");
  if (image && (!(image instanceof File) || !allowedImageTypes.includes(image.type) || image.size > 3 * 1024 * 1024)) {
    return NextResponse.json({ error: "Ảnh phải là JPEG, PNG, WebP hoặc GIF và không quá 3 MB." }, { status: 400 });
  }

  const existingCard = await prisma.gachaCard.findUnique({
    where: { id },
    select: { id: true, category: true, imageMimeType: true },
  });
  if (!existingCard) return NextResponse.json({ error: "Không tìm thấy thẻ." }, { status: 404 });

  const normalized = normalizeGachaCardData(parsed.data);
  const nextImage = image instanceof File && image.size > 0;
  const removeImage = formData.get("removeImage") === "true" && !nextImage;

  try {
    const card = await prisma.gachaCard.update({
      where: { id },
      data: {
        ...normalized,
        ...(nextImage ? {
          imageData: new Uint8Array(await image.arrayBuffer()),
          imageMimeType: image.type,
        } : removeImage ? {
          imageData: null,
          imageMimeType: null,
        } : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        battleType: true,
        rarity: true,
        attack: true,
        defense: true,
      },
    });
    return NextResponse.json({ success: true, card });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Slug thẻ đã được sử dụng." }, { status: 409 });
    }
    throw error;
  }
}
