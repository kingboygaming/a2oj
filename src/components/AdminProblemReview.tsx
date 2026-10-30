"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PendingProblem = {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
  author: { displayName: string; username: string };
  _count: { testCases: number };
};

export function AdminProblemReview({
  problems,
}: {
  problems: PendingProblem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function approve(problemId: string) {
    setPendingId(problemId);
    setError("");

    try {
      const response = await fetch(`/api/admin/problems/${problemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Không thể duyệt đề. Hãy thử lại.");
        return;
      }

      router.refresh();
    } catch {
      setError("Không thể kết nối để duyệt đề.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-[var(--line)]">
        {problems.map((problem) => (
          <li
            key={problem.id}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <Link
                href={`/problems/${problem.slug}`}
                className="font-medium text-[var(--teal)] hover:underline"
              >
                {problem.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {problem.slug} · @{problem.author.username} ({problem.author.displayName})
                {" · "}{problem._count.testCases} test ·{" "}
                {new Date(problem.createdAt).toLocaleDateString("vi-VN")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={`/admin/problems/${problem.id}/edit`}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--navy)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
              >
                Chỉnh sửa
              </Link>
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => approve(problem.id)}
                className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {pendingId === problem.id ? "Đang duyệt..." : "Duyệt và xuất bản"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="border-t border-[var(--line)] px-5 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
