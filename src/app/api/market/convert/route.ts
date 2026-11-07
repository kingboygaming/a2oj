import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 1 Attendance Point (Điểm chuyên cần) = 10 A2 Coins
export const ATTENDANCE_POINT_TO_COIN_RATE = 10;

const convertSchema = z.object({
  attendancePoints: z.number().int().min(1).max(1_000_000),
});

// POST /api/market/convert - Convert Attendance Points into A2 Coins
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Số điểm quy đổi không hợp lệ." }, { status: 400 });
  }

  const pointsToConvert = parsed.data.attendancePoints;
  const coinsToReceive = pointsToConvert * ATTENDANCE_POINT_TO_COIN_RATE;

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true, a2Coins: true },
    });

    if (account.gachaTickets < pointsToConvert) {
      return {
        error: `Bạn chỉ có ${account.gachaTickets} Điểm chuyên cần, không đủ ${pointsToConvert} điểm để quy đổi.`,
      };
    }

    // Deduct attendance points (gachaTickets) and credit a2Coins
    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        gachaTickets: { decrement: pointsToConvert },
        a2Coins: { increment: coinsToReceive },
      },
      select: { gachaTickets: true, a2Coins: true },
    });

    // Record transaction ledger
    await tx.pointTransaction.create({
      data: {
        userId: user.id,
        amount: coinsToReceive,
        currency: "A2_COIN",
        type: "CONVERT_POINT_TO_COIN",
        description: `Quy đổi ${pointsToConvert} Điểm chuyên cần sang ${coinsToReceive.toLocaleString("vi-VN")} A2 Coins (Tỉ lệ 1:${ATTENDANCE_POINT_TO_COIN_RATE})`,
      },
    });

    return {
      newAttendancePoints: updated.gachaTickets,
      newA2Coins: updated.a2Coins,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: `Đổi thành công ${pointsToConvert} Điểm chuyên cần thành ${coinsToReceive.toLocaleString("vi-VN")} A2 Coins!`,
    coinsReceived: coinsToReceive,
    pointsConverted: pointsToConvert,
    newAttendancePoints: result.newAttendancePoints,
    newA2Coins: result.newA2Coins,
  });
}