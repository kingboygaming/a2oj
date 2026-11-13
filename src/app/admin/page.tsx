import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminProblemReview } from "@/components/AdminProblemReview";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const [userCount, problemCount, publishedCount, pendingCount, submissionCount, contestCount, pendingProblems] =
    await Promise.all([
      prisma.user.count(),
      prisma.problem.count({ where: { contestOnly: false } }),
      prisma.problem.count({ where: { published: true, contestOnly: false } }),
      prisma.problem.count({ where: { published: false, contestOnly: false } }),
      prisma.submission.count(),
      prisma.contest.count(),
      prisma.problem.findMany({
        where: { published: false, contestOnly: false },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: {
          id: true,
          slug: true,
          title: true,
          createdAt: true,
          author: { select: { displayName: true, username: true } },
          _count: { select: { testCases: true } },
        },
      }),
    ]);

  const stats = [
    { label: "Tài khoản", value: userCount },
    { label: "Bài tập đã đăng", value: publishedCount },
    { label: "Đề chờ duyệt", value: pendingCount },
    { label: "Bài nộp", value: submissionCount },
    { label: "Contest", value: contestCount },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
          Khu vực quản trị
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">
          Bảng điều khiển
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Xin chào {user.displayName}. Quản lý nội dung và hoạt động của A2OJ tại đây.
        </p>
      </header>

      <section aria-label="Thống kê tổng quan" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4"
          >
            <p className="text-sm text-[var(--muted)]">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="font-semibold text-[var(--navy)]">Đề đóng góp chờ duyệt</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Kiểm tra nội dung và test case trước khi xuất bản.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
            {pendingCount} đề
          </span>
        </div>
        {pendingProblems.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
            Hiện không có đề nào cần duyệt.
          </p>
        ) : (
          <AdminProblemReview problems={pendingProblems} />
        )}
      </section>

      <section aria-label="Các khu vực quản trị" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-10">
        <AdminModule title="Bài tập" detail={`${problemCount} đề · ${publishedCount} đã xuất bản`} href="/admin/problems" />
        <AdminModule title="Đăng tin" detail="Tạo thông báo hiển thị trên trang chủ" href="/admin/news" />
        <AdminModule title="Quản lý tài khoản" detail={`${userCount} tài khoản`} href="/admin/users" />
        <AdminModule title="Bài nộp" detail={`${submissionCount} lượt nộp · quản lý lịch sử`} href="/admin/submissions" />
        <AdminModule title="Quản lý contest" detail={`${contestCount} kỳ thi`} href="/admin/contests" />
        <AdminModule title="Thành tựu" detail="Tạo huy hiệu, điều kiện mở khóa và màu tên" href="/admin/achievements" />
        <AdminModule title="Gacha" detail="Banner, thẻ và tỉ lệ rơi" href="/admin/gacha" />
        <AdminModule title="Card Studio" detail="Tạo thẻ sưu tầm và thẻ chiến đấu PvP" href="/admin/cards/new" />
        <AdminModule title="Quản lý thẻ" detail="Chỉnh sửa thẻ và chỉ số đã tạo" href="/admin/cards" />
        <AdminModule title="Sự kiện thế giới" detail="Lịch, điều kiện tham gia và phần thưởng" href="/admin/world" />
      </section>
    </div>
  );
}

function AdminModule({
  title,
  detail,
  href,
}: {
  title: string;
  detail: string;
  href?: string;
}) {
  const className =
    "rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 transition-colors hover:border-[var(--teal)]";
  const content = (
    <>
      <h2 className="font-semibold text-[var(--navy)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
      {!href && <p className="mt-3 text-xs text-[var(--muted)]">Công cụ quản lý sẽ được bổ sung.</p>}
    </>
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
