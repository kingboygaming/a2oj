"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Article = { id: string; slug: string; title: string; category: string; summary: string; content: string; sourceName: string | null; sourceUrl: string | null; published: boolean };

export function WikiArticleForm({ article }: { article?: Article }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.published = form.has("published") ? "true" : "false";
    const response = await fetch(article ? `/api/wiki/${article.id}` : "/api/wiki", {
      method: article ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) { setError(data?.error ?? "Không thể lưu bài viết."); setPending(false); return; }
    router.push(`/wiki/${data.slug}`); router.refresh();
  }
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Tiêu đề<input required name="title" defaultValue={article?.title} minLength={2} maxLength={160} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" /></label>
      <label className="text-sm font-medium">Đường dẫn (slug)<input required name="slug" defaultValue={article?.slug} pattern="[a-z0-9-]+" minLength={2} maxLength={100} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" /></label>
      <label className="text-sm font-medium">Chủ đề<input required name="category" defaultValue={article?.category ?? "Thuật toán"} maxLength={60} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" /></label>
      <label className="text-sm font-medium">Tóm tắt<input name="summary" defaultValue={article?.summary} maxLength={300} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" /></label>
    </div>
    <label className="block text-sm font-medium">Nội dung (Markdown)<textarea required name="content" defaultValue={article?.content} minLength={10} rows={18} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Nguồn tham khảo<input name="sourceName" defaultValue={article?.sourceName ?? ""} maxLength={120} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" /></label>
      <label className="text-sm font-medium">Liên kết nguồn<input name="sourceUrl" type="url" defaultValue={article?.sourceUrl ?? ""} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" /></label>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={article?.published} /> Xuất bản công khai</label>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <button disabled={pending} className="rounded-md bg-[var(--teal)] px-4 py-2 font-medium text-white disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu bài viết"}</button>
  </form>;
}
