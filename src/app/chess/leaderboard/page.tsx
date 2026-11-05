import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng xếp hạng Elo cờ vua | A2OJ",
  description: "Bảng xếp hạng Elo cờ vua của học sinh trên A2OJ.",
};

const PAGE_SIZE = 50;

export default async function ChessLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ page: pageParam }, currentUser] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const requestedPage = Math.max(1, Number(pageParam) || 1);
  const where = {
    role: "STUDENT" as const,
    chessGamesPlayed: { gt: 0 },
  };
  const [total, player] = await Promise.all([
    prisma.user.count({ where }),
    currentUser?.role === "STUDENT"
      ? prisma.user.findFirst({
          where: { id: currentUser.id, ...where },
          select: {
            id: true,
            username: true,
            displayName: true,
            chessRating: true,
            chessGamesPlayed: true,
            chessWins: true,
            chessDraws: true,
            chessLosses: true,
            createdAt: true,
          },
        })
      : null,
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const standings = await prisma.user.findMany({
    where,
    orderBy: [
      { chessRating: "desc" },
      { chessWins: "desc" },
      { chessGamesPlayed: "asc" },
      { createdAt: "asc" },
    ],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarMimeType: true,
      school: true,
      chessRating: true,
      chessGamesPlayed: true,
      chessWins: true,
      chessDraws: true,
      chessLosses: true,
    },
  });
  const playerRank = player
    ? await prisma.user.count({
        where: {
          ...where,
          OR: [
            { chessRating: { gt: player.chessRating } },
            {
              chessRating: player.chessRating,
              chessWins: { gt: player.chessWins },
            },
            {
              chessRating: player.chessRating,
              chessWins: player.chessWins,
              chessGamesPlayed: { lt: player.chessGamesPlayed },
            },
            {
              chessRating: player.chessRating,
              chessWins: player.chessWins,
              chessGamesPlayed: player.chessGamesPlayed,
              createdAt: { lt: player.createdAt },
            },
          ],
        },
      }) + 1
    : null;

  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
            A2OJ · Chess Arena
          </p>
          <h1 className="mt-1 text-3xl font-black text-[var(--navy)]">
            Bảng xếp hạng Elo
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Xếp hạng toàn trường theo kết quả các ván cờ có tính Elo.
          </p>
        </div>
        <Link
          className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--teal)] hover:bg-[var(--paper)]"
          href="/chess"
        >
          Vào Chess Arena
        </Link>
      </header>

      {player && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">
            Xếp hạng của bạn
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-[var(--navy)]">{player.displayName}</p>
              <p className="text-xs text-[var(--muted)]">@{player.username}</p>
            </div>
            <div className="flex gap-5">
              <Stat label="Hạng" value={`#${playerRank}`} />
              <Stat label="Elo" value={player.chessRating.toLocaleString("vi-VN")} />
              <Stat label="Ván" value={player.chessGamesPlayed.toLocaleString("vi-VN")} />
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold text-[var(--navy)]">Học sinh toàn trường</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {total.toLocaleString("vi-VN")} kỳ thủ đã có ván rated
            </p>
          </div>
          <span className="rounded-lg bg-[var(--background)] px-2.5 py-1 font-mono text-xs text-[var(--muted)]">
            {page} / {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Bảng xếp hạng Elo cờ vua toàn trường</caption>
            <thead className="bg-[var(--background)] text-xs text-[var(--muted)]">
              <tr>
                <th className="w-16 px-4 py-3 font-semibold">Hạng</th>
                <th className="px-3 py-3 font-semibold">Học sinh</th>
                <th className="px-3 py-3 text-right font-semibold">Elo</th>
                <th className="px-3 py-3 text-right font-semibold">Ván</th>
                <th className="px-5 py-3 text-right font-semibold">Thắng / Hòa / Thua</th>
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-sm text-[var(--muted)]" colSpan={5}>
                    Chưa có ván đấu rated. Đăng nhập và bật “Tính Elo” khi tạo trận để lên bảng.
                  </td>
                </tr>
              ) : (
                standings.map((standing, index) => {
                  const rank = (page - 1) * PAGE_SIZE + index + 1;
                  return (
                    <tr
                      className="border-t border-[var(--line)] transition hover:bg-[var(--background)]"
                      key={standing.id}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex size-8 items-center justify-center rounded-full font-mono text-xs font-bold ${
                            rank === 1
                              ? "bg-amber-400/15 text-amber-500"
                              : rank === 2
                                ? "bg-slate-400/15 text-slate-400"
                                : rank === 3
                                  ? "bg-orange-400/15 text-orange-500"
                                  : "text-[var(--muted)]"
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          {standing.avatarMimeType ? (
                            <Image
                              alt=""
                              className="size-8 rounded-full object-cover"
                              src={`/api/users/${encodeURIComponent(standing.username)}/avatar`}
                              height={32}
                              width={32}
                              unoptimized
                            />
                          ) : (
                            <span className="grid size-8 place-items-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
                              {standing.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div>
                            <Link
                              className="font-semibold text-[var(--navy)] hover:underline"
                              href={`/users/${encodeURIComponent(standing.username)}`}
                            >
                              {standing.displayName}
                            </Link>
                            <p className="text-[11px] text-[var(--muted)]">
                              {standing.school || `@${standing.username}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-base font-black tabular-nums text-emerald-500">
                        {standing.chessRating}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--muted)]">
                        {standing.chessGamesPlayed}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
                        <span className="text-emerald-500">{standing.chessWins}</span>
                        {" / "}
                        {standing.chessDraws}
                        {" / "}
                        <span className="text-rose-400">{standing.chessLosses}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav
            aria-label="Phân trang bảng xếp hạng Elo"
            className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3 sm:px-5"
          >
            {page > 1 ? (
              <Link
                className="text-sm font-semibold text-[var(--teal)] hover:underline"
                href={`/chess/leaderboard?page=${page - 1}`}
              >
                ← Trang trước
              </Link>
            ) : (
              <span />
            )}
            {page < totalPages && (
              <Link
                className="text-sm font-semibold text-[var(--teal)] hover:underline"
                href={`/chess/leaderboard?page=${page + 1}`}
              >
                Trang sau →
              </Link>
            )}
          </nav>
        )}
      </section>
      <p className="text-xs leading-5 text-[var(--muted)]">
        Mỗi người bắt đầu từ 1200 Elo. Thay đổi điểm được tính bởi máy chủ theo hệ số K=32
        trong 30 ván đầu, sau đó K=24. Chỉ tài khoản học sinh tham gia trận rated mới xuất
        hiện trên bảng xếp hạng.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-mono font-bold tabular-nums text-[var(--navy)]">{value}</p>
    </div>
  );
}
