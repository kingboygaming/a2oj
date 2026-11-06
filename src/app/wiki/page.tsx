import Link from "next/link";
import { getCurrentUser, canManageContests } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { wikiResources } from "@/lib/wiki-resources";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  const user = await getCurrentUser();
  const canWrite = !!user && canManageContests(user.role);
  const articles = await prisma.wikiArticle.findMany({
    where: canWrite ? (user.role === "ADMIN" ? {} : { OR: [{ published: true }, { authorId: user.id }] }) : { published: true },
    orderBy: [{ updatedAt: "desc" }], include: { author: { select: { displayName: true } } },
  });
  return <div className="space-y-10">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[var(--teal)]">THƯ VIỆN KIẾN THỨC</p><h1 className="mt-1 text-3xl font-semibold">Wiki</h1><p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Tài liệu lập trình thi đấu và bài viết do cộng đồng lớp mình biên soạn.</p></div>{canWrite && <Link href="/wiki/new" className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-medium text-white">Soạn bài</Link>}</header>
    <Link href="/wiki/roadmap" className="block rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm hover:border-[var(--teal)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--teal)]">LỘ TRÌNH HỌC</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Học thuật toán từ cơ bản đến nâng cao</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Khám phá các cấp độ học, kèm chủ đề, mốc tự kiểm tra và tài liệu tham khảo.</p>
        </div>
        <span aria-hidden="true" className="text-lg text-[var(--teal)]">→</span>
      </div>
    </Link>
    <section><h2 className="mb-4 text-xl font-semibold">Bài viết trong A2OJ</h2>{articles.length ? <div className="grid gap-3 md:grid-cols-2">{articles.map(a => <Link key={a.id} href={`/wiki/${a.slug}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 hover:border-[var(--teal)]"><div className="flex justify-between gap-3"><span className="text-xs font-medium text-[var(--teal)]">{a.category}</span>{!a.published && <span className="text-xs text-amber-600">Bản nháp</span>}</div><h3 className="mt-2 font-semibold">{a.title}</h3><p className="mt-1 text-sm text-[var(--muted)]">{a.summary || "Chưa có tóm tắt."}</p><p className="mt-3 text-xs text-[var(--muted)]">{a.author.displayName}</p></Link>)}</div> : <p className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">Chưa có bài viết. Giáo viên và quản trị viên có thể bắt đầu soạn bài.</p>}</section>
    {wikiResources.map(group => <section key={group.category}><h2 className="text-xl font-semibold">{group.category}</h2><p className="mt-1 text-sm text-[var(--muted)]">{group.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.items.map(item => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 hover:border-[var(--teal)]"><h3 className="font-medium">{item.title} <span aria-hidden="true">↗</span></h3><p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p><p className="mt-3 truncate text-xs text-[var(--teal)]">{item.url}</p></a>)}</div></section>)}
    <p className="text-xs text-[var(--muted)]">Tài liệu tham khảo thuộc VNOI Wiki; các liên kết sẽ mở nguồn gốc để tôn trọng nội dung và ghi nhận tác giả.</p>
  </div>;
}
