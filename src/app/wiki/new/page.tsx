import { redirect } from "next/navigation";
import { getCurrentUser, canManageContests } from "@/lib/auth";
import { WikiArticleForm } from "@/components/WikiArticleForm";

export default async function NewWikiArticlePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageContests(user.role)) redirect("/wiki");
  return <div className="mx-auto max-w-4xl space-y-5"><div><h1 className="text-3xl font-semibold">Soạn bài Wiki</h1><p className="mt-2 text-sm text-[var(--muted)]">Có thể lưu bản nháp và xuất bản khi sẵn sàng.</p></div><WikiArticleForm /></div>;
}
