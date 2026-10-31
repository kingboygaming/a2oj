import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminContestsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const contests = await prisma.contest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { displayName: true, username: true } },
      _count: {
        select: {
          problems: true,
          registrations: true,
          submissions: true,
        },
      },
    },
  });

  return (
    <div>
      <AdminBackLink />
      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
          Quản trị nội dung
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Quản lý contest</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Xóa contest sẽ xóa lượt đăng ký, bài nộp trong kỳ thi và các bài chỉ thuộc contest đó.
        </p>
      </header>

      {contests.length === 0 ? (
        <p className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center text-sm text-[var(--muted)]">
          Chưa có contest nào.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
              <tr>
                <th className="px-4 py-3 font-medium">Contest</th>
                <th className="px-4 py-3 font-medium">Người tạo</th>
                <th className="px-4 py-3 font-medium">Bài / thí sinh / nộp</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((contest) => (
                <tr key={contest.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contests/${contest.slug}`}
                      className="font-medium text-[var(--teal)] hover:underline"
                    >
                      {contest.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-[var(--muted)]">{contest.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {contest.author.displayName}
                    <p className="text-xs text-[var(--muted)]">@{contest.author.username}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {contest._count.problems} bài · {contest._count.registrations} thí sinh ·{" "}
                    {contest._count.submissions} bài nộp
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                    {contest.startAt.toLocaleDateString("vi-VN")} –{" "}
                    {contest.endAt.toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/contests/${contest.slug}/edit`}
                        className="rounded border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--navy)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
                        title="Chỉnh sửa thời gian, số bài và cấu hình contest"
                      >
                        ✏️ Sửa
                      </Link>
                      <a
                        href={`/api/admin/contests/${contest.id}/export-themis`}
                        download
                        className="rounded border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--teal)] hover:bg-[var(--teal)]/20"
                        title="Tải toàn bộ bài nộp chuẩn Themis (chỉ bài > 0 điểm)"
                      >
                        📥 Themis (.zip)
                      </a>
                      <AdminDeleteButton
                        endpoint={`/api/admin/contests/${contest.id}`}
                        confirmation={`Xóa contest "${contest.title}"? Thao tác này sẽ xóa ${contest._count.registrations} lượt đăng ký, ${contest._count.submissions} bài nộp trong contest và các bài chỉ dùng ở contest này. Không thể hoàn tác.`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminBackLink() {
  return (
    <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">
      ← Quay lại quản trị
    </Link>
  );
}
