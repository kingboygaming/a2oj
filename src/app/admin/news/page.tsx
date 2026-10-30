import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { AdminNewsForm } from "@/components/AdminNewsForm";
import { Markdown } from "@/components/Markdown";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const news = await prisma.news.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { displayName: true } } },
    take: 20,
  });

  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản trị
      </Link>
      <header className="mb-6 mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
          Quản trị nội dung
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Đăng tin A2OJ</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Tin được đăng sẽ hiển thị trên trang chủ. Có thể viết nội dung bằng Markdown.
        </p>
      </header>

      <AdminNewsForm />

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Tin đã đăng gần đây</h2>
        {news.length === 0 ? (
          <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">
            Chưa có tin nào.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {news.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {item.pinned && (
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-semibold text-amber-600">
                      Đã ghim
                    </span>
                  )}
                  <span>{item.author.displayName}</span>
                  <span>·</span>
                  <time dateTime={item.createdAt.toISOString()}>
                    {item.createdAt.toLocaleString("vi-VN")}
                  </time>
                </div>
                <h3 className="mt-2 font-semibold text-[var(--navy)]">{item.title}</h3>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  <Markdown source={item.body} />
                </div>
                <div className="mt-4 flex justify-end border-t border-[var(--line)] pt-3">
                  <AdminDeleteButton
                    endpoint={`/api/admin/news/${item.id}`}
                    confirmation={`Bạn có chắc muốn xóa tin "${item.title}"? Thao tác này không thể hoàn tác.`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
