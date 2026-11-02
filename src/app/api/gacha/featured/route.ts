import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const parsed = z.object({ cardId: z.string().min(1).nullable() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thẻ được chọn không hợp lệ." }, { status: 400 });

  if (parsed.data.cardId) {
    const owned = await prisma.userGachaCard.findUnique({
      where: { userId_cardId: { userId: user.id, cardId: parsed.data.cardId } },
      select: { cardId: true },
    });
    if (!owned) return NextResponse.json({ error: "Bạn chưa sở hữu thẻ này." }, { status: 403 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { featuredGachaCardId: parsed.data.cardId },
  });
  revalidatePath("/profile");
  revalidatePath("/gacha");
  revalidatePath(`/users/${encodeURIComponent(user.username)}`);
  return NextResponse.json({ success: true });
}
