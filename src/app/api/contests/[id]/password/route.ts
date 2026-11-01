import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setContestAccessCookie } from "@/lib/auth";
import { verifyContestPassword } from "@/lib/contest-password";

const schema = z.object({ password: z.string().trim().min(1).max(128) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Hãy nhập mật khẩu contest." }, { status: 400 });
  }

  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, passwordHash: true },
  });
  if (!contest) return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  if (!contest.passwordHash) {
    return NextResponse.json({ error: "Contest này không đặt mật khẩu." }, { status: 400 });
  }

  if (!(await verifyContestPassword(parsed.data.password, contest.passwordHash))) {
    return NextResponse.json({ error: "Mật khẩu contest không đúng." }, { status: 401 });
  }

  await setContestAccessCookie(contest.id, contest.passwordHash);
  return NextResponse.json({ success: true });
}
