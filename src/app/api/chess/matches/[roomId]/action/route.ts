import { Chess } from "chess.js";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), san: z.string().min(1).max(16) }),
  z.object({ type: z.literal("resign"), color: z.enum(["w", "b"]) }),
  z.object({ type: z.literal("timeout"), color: z.enum(["w", "b"]) }),
  z.object({ type: z.literal("draw-offer"), color: z.enum(["w", "b"]) }),
  z.object({ type: z.literal("draw-cancel"), color: z.enum(["w", "b"]) }),
  z.object({ type: z.literal("draw-accept") }),
  z.object({ type: z.literal("new-game") }),
]);

type MatchResult = "WHITE_WIN" | "BLACK_WIN" | "DRAW";

function getColor(match: { whiteUserId: string; blackUserId: string | null }, userId: string) {
  if (match.whiteUserId === userId) return "w";
  if (match.blackUserId === userId) return "b";
  return null;
}

function getRatingDelta(
  ownRating: number,
  opponentRating: number,
  ownGames: number,
  ownScore: number,
) {
  const expected = 1 / (1 + 10 ** ((opponentRating - ownRating) / 400));
  return Math.round((ownGames < 30 ? 32 : 24) * (ownScore - expected));
}

async function applyResult(
  transaction: Prisma.TransactionClient,
  match: {
    id: string;
    moves: string;
    whiteUserId: string;
    blackUserId: string | null;
  },
  result: MatchResult,
  finalMoves = match.moves,
) {
  if (!match.blackUserId) throw new Error("Trận chưa có đủ hai người chơi.");

  const [white, black] = await Promise.all([
    transaction.user.findUniqueOrThrow({
      where: { id: match.whiteUserId },
      select: { chessRating: true, chessGamesPlayed: true },
    }),
    transaction.user.findUniqueOrThrow({
      where: { id: match.blackUserId },
      select: { chessRating: true, chessGamesPlayed: true },
    }),
  ]);
  const whiteScore = result === "WHITE_WIN" ? 1 : result === "DRAW" ? 0.5 : 0;
  const blackScore = 1 - whiteScore;
  const whiteDelta = getRatingDelta(
    white.chessRating,
    black.chessRating,
    white.chessGamesPlayed,
    whiteScore,
  );
  const blackDelta = getRatingDelta(
    black.chessRating,
    white.chessRating,
    black.chessGamesPlayed,
    blackScore,
  );

  const finalized = await transaction.chessMatch.updateMany({
    where: { id: match.id, status: "IN_PROGRESS", moves: match.moves },
    data: {
      moves: finalMoves,
      status: "FINISHED",
      result,
      finishedAt: new Date(),
    },
  });
  if (finalized.count !== 1) throw new Error("Trận đấu vừa được cập nhật ở thiết bị khác.");

  await Promise.all([
    transaction.user.update({
      where: { id: match.whiteUserId },
      data: {
        chessRating: { increment: whiteDelta },
        chessGamesPlayed: { increment: 1 },
        ...(result === "WHITE_WIN"
          ? { chessWins: { increment: 1 } }
          : result === "DRAW"
            ? { chessDraws: { increment: 1 } }
            : { chessLosses: { increment: 1 } }),
      },
    }),
    transaction.user.update({
      where: { id: match.blackUserId },
      data: {
        chessRating: { increment: blackDelta },
        chessGamesPlayed: { increment: 1 },
        ...(result === "BLACK_WIN"
          ? { chessWins: { increment: 1 } }
          : result === "DRAW"
            ? { chessDraws: { increment: 1 } }
            : { chessLosses: { increment: 1 } }),
      },
    }),
  ]);

  return {
    result,
    whiteRatingChange: whiteDelta,
    blackRatingChange: blackDelta,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Chỉ học sinh được tham gia bảng Elo." }, { status: 403 });
  }

  const { roomId } = await context.params;
  if (!/^[a-f0-9]{10}$/.test(roomId)) {
    return NextResponse.json({ error: "Mã phòng không hợp lệ." }, { status: 400 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nước đi hoặc hành động không hợp lệ." }, { status: 400 });
  }

  try {
    const response = await prisma.$transaction(async (transaction) => {
      const match = await transaction.chessMatch.findFirst({
        where: {
          roomId,
          OR: [{ whiteUserId: user.id }, { blackUserId: user.id }],
        },
        orderBy: { createdAt: "desc" },
      });
      if (!match) throw new Error("Không tìm thấy trận xếp hạng của bạn.");

      const color = getColor(match, user.id);
      if (!color) throw new Error("Bạn không tham gia trận đấu này.");
      const action = parsed.data;

      if (action.type === "new-game") {
        if (color !== "w" || match.status !== "FINISHED" || !match.blackUserId) {
          throw new Error("Trận hiện tại chưa kết thúc.");
        }
        const nextMatch = await transaction.chessMatch.create({
          data: {
            roomId,
            whiteUserId: match.whiteUserId,
            blackUserId: match.blackUserId,
            timeControlId: match.timeControlId,
            status: "IN_PROGRESS",
            initialTimeMs: match.initialTimeMs,
            whiteTimeMs: match.initialTimeMs,
            blackTimeMs: match.initialTimeMs,
            incrementSeconds: match.incrementSeconds,
            clockStartedAt: new Date(),
          },
          select: { id: true },
        });
        return { matchId: nextMatch.id };
      }

      if (match.status !== "IN_PROGRESS" || !match.blackUserId) {
        throw new Error("Trận xếp hạng chưa bắt đầu hoặc đã kết thúc.");
      }

      const game = new Chess();
      const savedMoves: unknown = JSON.parse(match.moves);
      if (
        !Array.isArray(savedMoves) ||
        savedMoves.length > 1000 ||
        savedMoves.some((san) => typeof san !== "string")
      ) {
        throw new Error("Lịch sử trận đấu không hợp lệ.");
      }
      for (const san of savedMoves) game.move(san);

      if (action.type === "timeout" && action.color !== color) {
        throw new Error("Chỉ có thể xác nhận hết giờ của bạn.");
      }

      const activeColor = game.turn();
      const remainingMs = activeColor === "w" ? match.whiteTimeMs : match.blackTimeMs;
      const now = new Date();
      if (!match.clockStartedAt) throw new Error("Đồng hồ trận đấu chưa được khởi động.");
      const elapsedMs = Math.max(0, now.getTime() - match.clockStartedAt.getTime());
      if (elapsedMs >= remainingMs) {
        const rating = await applyResult(
          transaction,
          match,
          activeColor === "w" ? "BLACK_WIN" : "WHITE_WIN",
        );
        return {
          matchId: match.id,
          action: { type: "timeout" as const, color: activeColor },
          ...rating,
        };
      }

      if (action.type === "timeout") {
        return { matchId: match.id, pendingTimeout: true };
      }

      if (action.type === "move") {
        if (activeColor !== color || game.isGameOver()) {
          throw new Error("Chưa đến lượt của bạn.");
        }
        const move = game.move(action.san);
        const moves = JSON.stringify(game.history());
        const endResult: MatchResult | null = game.isCheckmate()
          ? game.turn() === "w"
            ? "BLACK_WIN"
            : "WHITE_WIN"
          : game.isDraw()
            ? "DRAW"
            : null;

        if (endResult) {
          const rating = await applyResult(
            transaction,
            match,
            endResult,
            moves,
          );
          return {
            matchId: match.id,
            san: move.san,
            moves: game.history(),
            ...rating,
          };
        }

        const updated = await transaction.chessMatch.updateMany({
          where: {
            id: match.id,
            status: "IN_PROGRESS",
            moves: match.moves,
            clockStartedAt: match.clockStartedAt,
          },
          data: {
            moves,
            ...(color === "w"
              ? { whiteTimeMs: remainingMs - elapsedMs + match.incrementSeconds * 1000 }
              : { blackTimeMs: remainingMs - elapsedMs + match.incrementSeconds * 1000 }),
            clockStartedAt: now,
          },
        });
        if (updated.count !== 1) throw new Error("Nước đi đã được xử lý ở thiết bị khác.");
        return { matchId: match.id, san: move.san, moves: game.history() };
      }

      let result: MatchResult | null = null;
      let drawOfferBy = match.drawOfferBy;
      if (action.type === "resign") {
        if (action.color !== color) throw new Error("Chỉ có thể xác nhận đầu hàng hoặc hết giờ của bạn.");
        result = color === "w" ? "BLACK_WIN" : "WHITE_WIN";
      } else if (action.type === "draw-offer") {
        if (action.color !== color || activeColor !== color) {
          throw new Error("Lời xin hòa không khớp lượt đi của bạn.");
        }
        drawOfferBy = user.id;
      } else if (action.type === "draw-cancel") {
        if (action.color !== color || activeColor !== color || match.drawOfferBy !== user.id) {
          throw new Error("Không có lời xin hòa của bạn để hủy.");
        }
        drawOfferBy = null;
      } else if (action.type === "draw-accept") {
        if (!match.drawOfferBy || match.drawOfferBy === user.id) {
          throw new Error("Không có lời xin hòa từ đối thủ.");
        }
        result = "DRAW";
      }

      if (result) {
        const rating = await applyResult(transaction, match, result);
        return { matchId: match.id, ...rating };
      }

      const updated = await transaction.chessMatch.updateMany({
        where: {
          id: match.id,
          status: "IN_PROGRESS",
          moves: match.moves,
          drawOfferBy: match.drawOfferBy,
        },
        data: { drawOfferBy },
      });
      if (updated.count !== 1) throw new Error("Hành động vừa được xử lý ở thiết bị khác.");
      return { matchId: match.id, drawOfferBy };
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể cập nhật trận đấu.";
    const status = /đăng nhập|Bạn không|tìm thấy/.test(message)
      ? 403
      : /hợp lệ|khớp|Chỉ có thể|Chưa đến|Không có|chưa bắt đầu|chưa kết thúc/.test(message)
        ? 400
        : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
