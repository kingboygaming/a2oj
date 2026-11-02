import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { GACHA_RARITIES } from "@/lib/gacha";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });

  const formData = await request.formData();
  const parsed = z.object({
    slug: z.string().trim()
      .min(2, "Slug thẻ cần ít nhất 2 ký tự.")
      .max(80, "Slug thẻ tối đa 80 ký tự.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang."),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).default(""),
    rarity: z.enum(GACHA_RARITIES),
    specialOnly: z.enum(["true", "false"]).transform((value) => value === "true"),
  }).safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    rarity: formData.get("rarity"),
    specialOnly: formData.get("specialOnly") ?? "true",
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin thẻ không hợp lệ." }, { status: 400 });

  const image = formData.get("image");
  if (!(image instanceof File) || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type) || image.size <= 0 || image.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Hãy tải ảnh JPEG, PNG, WebP hoặc GIF không quá 3 MB." }, { status: 400 });
  }
  try {
    const card = await prisma.gachaCard.create({
      data: {
        ...parsed.data,
        specialOnly: parsed.data.specialOnly,
        imageData: new Uint8Array(await image.arrayBuffer()),
        imageMimeType: image.type,
      },
      select: { id: true, slug: true, name: true, rarity: true },
    });
    return NextResponse.json({ success: true, card }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Slug thẻ đã được sử dụng." }, { status: 409 });
    }
    throw error;
  }
}
