"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminNewsForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function publishNews(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, pinned }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Không đăng được tin.");
        return;
      }
      setTitle("");
      setBody("");
      setPinned(false);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Không thể kết nối để đăng tin. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={publishNews}
      className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6"
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--navy)]">
          Tiêu đề
        </span>
        <input
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[var(--teal)]"
          placeholder="Thông báo mới của A2OJ"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--navy)]">
          Nội dung <span className="font-normal text-[var(--muted)]">(hỗ trợ Markdown)</span>
        </span>
        <textarea
          required
          maxLength={10000}
          rows={9}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm leading-6 text-[var(--navy)] outline-none focus:border-[var(--teal)]"
          placeholder="Viết nội dung thông báo..."
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--navy)]">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(event) => setPinned(event.target.checked)}
          className="size-4 accent-[var(--teal)]"
        />
        Ghim tin lên đầu danh sách
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          Tin đã được đăng trên trang chủ.
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--surface-strong-hover)] disabled:opacity-50"
        >
          {pending ? "Đang đăng..." : "Đăng tin"}
        </button>
      </div>
    </form>
  );
}
