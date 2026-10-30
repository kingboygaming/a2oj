import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = passwordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Mật khẩu mới cần từ 8 đến 72 ký tự." },
      { status: 400 },
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, sessionVersion: true },
  });
  if (!account || !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
  }
  if (await verifyPassword(parsed.data.newPassword, account.passwordHash)) {
    return NextResponse.json(
      { error: "Mật khẩu mới phải khác mật khẩu hiện tại." },
      { status: 400 },
    );
  }

  const sessionVersion = account.sessionVersion + 1;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
      sessionVersion,
    },
  });
  await setSessionCookie(user.id, sessionVersion);
  return NextResponse.json({ success: true });
}
