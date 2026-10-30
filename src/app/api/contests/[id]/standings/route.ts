import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { problems: { orderBy: { letter: "asc" } } },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  const subs = await prisma.submission.findMany({
    where: { contestId: contest.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, displayName: true, username: true } } },
  });

  type Cell = { score: number; timeMs: number; attempts: number; accepted: boolean };
  const byUser = new Map<
    string,
    {
      user: { id: string; displayName: string; username: string };
      cells: Record<string, Cell>;
      solved: number;
      penalty: number;
    }
  >();

  for (const sub of subs) {
    const row =
      byUser.get(sub.userId) ??
      {
        user: sub.user,
        cells: {},
        solved: 0,
        penalty: 0,
      };
    const cell = row.cells[sub.problemId] ?? {
      score: 0,
      timeMs: 0,
      attempts: 0,
      accepted: false,
    };
    if (cell.accepted) {
      byUser.set(sub.userId, row);
      continue;
    }
    cell.attempts += 1;
    if (sub.verdict === "AC") {
      cell.accepted = true;
      cell.score = contest.problems.find((p) => p.problemId === sub.problemId)?.points ?? 100;
      cell.timeMs = sub.createdAt.getTime() - contest.startAt.getTime();
      row.solved += 1;
      row.penalty += Math.max(0, Math.floor(cell.timeMs / 60000)) + (cell.attempts - 1) * 20;
    }
    row.cells[sub.problemId] = cell;
    byUser.set(sub.userId, row);
  }

  const standings = [...byUser.values()].sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    return a.penalty - b.penalty;
  });

  return NextResponse.json({
    contest: { id: contest.id, title: contest.title, problems: contest.problems },
    standings,
  });
}
