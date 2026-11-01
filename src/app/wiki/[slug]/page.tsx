import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, canManageContests } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Markdown } from "@/components/Markdown";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

export const dynamic = "force-dynamic";

export default async function WikiArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const user = await getCurrentUser();
  const article = await prisma.wikiArticle.findUnique({ where: { slug }, include: { author: { select: { displayName: true } } } });
  if (!article || (!article.published && (!user || (user.id !== article.authorId && user.role !== "ADMIN")))) notFound();
  const canEdit = !!user && canManageContests(user.role) && (user.id === article.authorId || user.role === "ADMIN");
  return <article className="mx-auto max-w-4xl"><Link href="/wiki" className="text-sm text-[var(--teal)] hover:underline">← Thư viện Wiki</Link><header className="mt-5 border-b border-[var(--line)] pb-5"><p className="text-sm font-medium text-[var(--teal)]">{article.category}</p><h1 className="mt-2 text-3xl font-semibold">{article.title}</h1>{article.summary && <p className="mt-3 text-[var(--muted)]">{article.summary}</p>}<p className="mt-3 text-xs text-[var(--muted)]">{article.author.displayName} · Cập nhật {article.updatedAt.toLocaleDateString("vi-VN")}{!article.published && " · Bản nháp"}</p>{canEdit && <div className="mt-4 flex items-center gap-3"><Link href={`/wiki/${article.slug}/edit`} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm">Sửa bài</Link><AdminDeleteButton endpoint={`/api/wiki/${article.id}`} confirmation="Bạn có chắc muốn xóa bài Wiki này?" /></div>}</header><div className="py-6"><Markdown source={article.content} /></div>{article.sourceUrl && <aside className="mt-6 rounded-lg border border-[var(--line)] p-4 text-sm">Nguồn tham khảo: <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--teal)] underline">{article.sourceName || article.sourceUrl}</a></aside>}</article>;
}
