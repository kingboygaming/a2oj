import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      author: { select: { displayName: true } },
      problems: {
        include: { problem: { select: { id: true, slug: true, title: true, difficulty: true } } },
        orderBy: { letter: "asc" },
      },
      _count: { select: { registrations: true } },
    },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }
  return NextResponse.json(contest);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action !== "register") {
    return NextResponse.json({ error: "Hành động không hỗ trợ." }, { status: 400 });
  }

  await prisma.contestRegistration.upsert({
    where: {
      contestId_userId: { contestId: contest.id, userId: user.id },
    },
    update: {},
    create: { contestId: contest.id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
