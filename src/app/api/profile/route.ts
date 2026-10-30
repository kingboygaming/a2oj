import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500),
  school: z.string().trim().max(120),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin hồ sơ không hợp lệ." }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: { displayName: true, bio: true, school: true },
  });
  return NextResponse.json({ user: updatedUser });
}
