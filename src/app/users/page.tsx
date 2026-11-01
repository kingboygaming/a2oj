import Link from "next/link";
import { getGlobalAcmLeaderboard } from "@/lib/global-leaderboard";
import { EmptyState } from "@/components/EmptyState";
import { getRankColorClasses } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const standings = await getGlobalAcmLeaderboard();
  const rankColors = await getRankColorClasses(standings.map((standing) => standing.userId));

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
          Sân chơi toàn hệ thống
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">
          Danh sách thí sinh
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {standings.length.toLocaleString("vi-VN")} thí sinh · xếp hạng theo số bài
          giải được và penalty ACM.
        </p>
      </div>

      <section
        aria-label="Danh sách thí sinh theo xếp hạng ACM"
        className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]"
      >
        {standings.length === 0 ? (
          <EmptyState
            type="no-users"
            title="Chưa có thí sinh nào"
            description="Chưa có tài khoản nào tham gia giải bài trên hệ thống."
            action={{
              label: "Khám phá bài tập",
              href: "/problems",
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
                <tr>
                  <th scope="col" className="w-16 px-5 py-3 font-medium">Hạng</th>
                  <th scope="col" className="px-3 py-3 font-medium">Thí sinh</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">AC</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Penalty (phút)
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => (
                  <tr
                    key={standing.userId}
                    className="border-t border-[var(--line)] transition-colors duration-300 hover:bg-[var(--background)]"
                  >
                    <td className="px-5 py-3 font-mono text-[var(--muted)]">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/users/${encodeURIComponent(standing.username)}`}
                        className={`font-medium ${rankColors[standing.userId] ?? "text-slate-600 dark:text-slate-300"} hover:underline`}
                      >
                        {standing.displayName}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">@{standing.username}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-emerald-500">
                      {standing.solved}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--muted)]">
                      {standing.penalty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
