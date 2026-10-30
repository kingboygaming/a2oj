import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu tài khoản hoặc mật khẩu." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  await setSessionCookie(user.id, user.sessionVersion);
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
