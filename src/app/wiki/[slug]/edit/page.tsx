import { notFound, redirect } from "next/navigation";
import { getCurrentUser, canManageContests } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WikiArticleForm } from "@/components/WikiArticleForm";

export default async function EditWikiArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const user = await getCurrentUser();
  if (!user) redirect("/login"); if (!canManageContests(user.role)) redirect("/wiki");
  const article = await prisma.wikiArticle.findUnique({ where: { slug } });
  if (!article || (user.id !== article.authorId && user.role !== "ADMIN")) notFound();
  return <div className="mx-auto max-w-4xl space-y-5"><h1 className="text-3xl font-semibold">Sửa bài Wiki</h1><WikiArticleForm article={article} /></div>;
}
