import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminGachaTickets } from "@/components/AdminGachaTickets";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị viên",
} as const;

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "ADMIN") notFound();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      createdAt: true,
      gachaTickets: true,
      _count: {
        select: {
          submissions: true,
          problems: true,
          contests: true,
          registrations: true,
          news: true,
        },
      },
    },
  });
  const adminCount = users.filter((user) => user.role === "ADMIN").length;

  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản trị
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
          Quản trị tài khoản
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">
          Quản lý tài khoản
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Xóa tài khoản sẽ xóa toàn bộ bài nộp và lượt đăng ký của tài khoản; contest do tài khoản
          tạo cùng bài nộp/đăng ký của các thí sinh trong các contest đó; bài, test case và tin tức
          do tài khoản tạo. Bài được dùng trong contest khác sẽ bị gỡ khỏi contest đó. Không thể
          xóa tài khoản admin cuối cùng.
        </p>
      </header>

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
            <tr>
              <th className="px-4 py-3 font-medium">Tài khoản</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Dữ liệu</th>
              <th className="px-4 py-3 font-medium">Lượt quay</th>
              <th className="px-4 py-3 font-medium">Ngày tạo</th>
              <th className="px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isCurrentUser = user.id === currentUser.id;
              const isLastAdmin = user.role === "ADMIN" && adminCount <= 1;
              const confirmation =
                `Xóa tài khoản @${user.username} (${user.displayName}) và toàn bộ dữ liệu liên quan? ` +
                `Bài nộp: ${user._count.submissions}, bài đã tạo: ${user._count.problems}, ` +
                `contest đã tạo: ${user._count.contests}, lượt đăng ký: ${user._count.registrations}, ` +
                `tin tức: ${user._count.news}. Bài nộp và đăng ký của thí sinh khác trong contest do tài khoản này tạo cũng sẽ bị xóa. ` +
                "Thao tác này không thể hoàn tác.";

              return (
                <tr key={user.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--navy)]">{user.displayName}</span>
                    <p className="text-xs text-[var(--muted)]">@{user.username}</p>
                    {isCurrentUser && (
                      <span className="mt-1 inline-block text-xs text-[var(--teal)]">
                        Tài khoản hiện tại
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {user._count.submissions} bài nộp · {user._count.problems} bài ·{" "}
                    {user._count.contests} contest · {user._count.registrations} lượt đăng ký ·{" "}
                    {user._count.news} tin
                  </td>
                  <td className="px-4 py-3">
                    <AdminGachaTickets userId={user.id} initialTickets={user.gachaTickets} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                    {user.createdAt.toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isCurrentUser || isLastAdmin ? (
                      <span className="text-xs text-[var(--muted)]">
                        {isCurrentUser ? "Không thể xóa chính mình" : "Admin cuối cùng"}
                      </span>
                    ) : (
                      <AdminDeleteButton
                        endpoint={`/api/admin/users/${user.id}`}
                        confirmation={confirmation}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
