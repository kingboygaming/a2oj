import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChessTimeControl } from "@/lib/chess-time-controls";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    roomId: z.string().regex(/^[a-f0-9]{10}$/),
    timeControlId: z
      .string()
      .refine((id) => getChessTimeControl(id) !== null),
  }),
  z.object({
    action: z.literal("join"),
    roomId: z.string().regex(/^[a-f0-9]{10}$/),
  }),
]);

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Chỉ học sinh được tham gia bảng Elo." }, { status: 403 });
  }

  const roomId = new URL(request.url).searchParams.get("roomId");
  if (!roomId || !/^[a-f0-9]{10}$/.test(roomId)) {
    return NextResponse.json({ error: "Mã phòng không hợp lệ." }, { status: 400 });
  }

  const match = await prisma.chessMatch.findFirst({
    where: {
      roomId,
      OR: [{ whiteUserId: user.id }, { blackUserId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      roomId: true,
      whiteUserId: true,
      blackUserId: true,
      timeControlId: true,
      status: true,
      whitePlayer: { select: { displayName: true } },
      blackPlayer: { select: { displayName: true } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Không tìm thấy trận có xếp hạng." }, { status: 404 });
  }

  return NextResponse.json({
    matchId: match.id,
    roomId: match.roomId,
    whiteUserId: match.whiteUserId,
    blackUserId: match.blackUserId,
    timeControlId: match.timeControlId,
    status: match.status,
    whitePlayerName: match.whitePlayer.displayName,
    blackPlayerName: match.blackPlayer?.displayName ?? null,
    rated: true,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để chơi trận có xếp hạng." }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Chỉ học sinh được tham gia bảng Elo." }, { status: 403 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin trận cờ không hợp lệ." }, { status: 400 });
  }

  if (parsed.data.action === "create") {
    const timeControl = getChessTimeControl(parsed.data.timeControlId);
    if (!timeControl) {
      return NextResponse.json({ error: "Nhịp thời gian không hợp lệ." }, { status: 400 });
    }
    const existing = await prisma.chessMatch.findFirst({
      where: {
        roomId: parsed.data.roomId,
        whiteUserId: user.id,
        status: "WAITING",
      },
      select: { id: true, timeControlId: true },
    });
    const match =
      existing ??
      (await prisma.chessMatch.create({
        data: {
          roomId: parsed.data.roomId,
          whiteUserId: user.id,
          timeControlId: parsed.data.timeControlId,
          initialTimeMs: timeControl.initialSeconds * 1000,
          incrementSeconds: timeControl.incrementSeconds,
        },
        select: { id: true, timeControlId: true },
      }));

    return NextResponse.json({
      matchId: match.id,
      timeControlId: match.timeControlId,
      rated: true,
    });
  }

  const waitingMatch = await prisma.chessMatch.findFirst({
    where: {
      roomId: parsed.data.roomId,
      status: "WAITING",
      whiteUserId: { not: user.id },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      whiteUserId: true,
      timeControlId: true,
      initialTimeMs: true,
      incrementSeconds: true,
    },
  });

  if (!waitingMatch) {
    const alreadyJoined = await prisma.chessMatch.findFirst({
      where: {
        roomId: parsed.data.roomId,
        status: "IN_PROGRESS",
        OR: [{ whiteUserId: user.id }, { blackUserId: user.id }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, whiteUserId: true, timeControlId: true },
    });
    if (alreadyJoined) {
      return NextResponse.json({
        matchId: alreadyJoined.id,
        timeControlId: alreadyJoined.timeControlId,
        whiteUserId: alreadyJoined.whiteUserId,
        rated: true,
      });
    }
    return NextResponse.json({ error: "Phòng xếp hạng đã đầy hoặc không còn mở." }, { status: 409 });
  }

  const joined = await prisma.chessMatch.updateMany({
    where: {
      id: waitingMatch.id,
      status: "WAITING",
      blackUserId: null,
    },
    data: {
      blackUserId: user.id,
      status: "IN_PROGRESS",
      whiteTimeMs: waitingMatch.initialTimeMs,
      blackTimeMs: waitingMatch.initialTimeMs,
      incrementSeconds: waitingMatch.incrementSeconds,
      clockStartedAt: new Date(),
    },
  });

  if (joined.count !== 1) {
    return NextResponse.json({ error: "Người chơi khác vừa tham gia phòng này." }, { status: 409 });
  }

  return NextResponse.json({
    matchId: waitingMatch.id,
    timeControlId: waitingMatch.timeControlId,
    whiteUserId: waitingMatch.whiteUserId,
    rated: true,
  });
}
