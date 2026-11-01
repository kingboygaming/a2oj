"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SubmissionStatusRefresh({ verdict }: { verdict: string }) {
  const router = useRouter();
  const pending = verdict === "QUEUED" || verdict === "RUNNING";

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [pending, router]);

  if (!pending) return null;
  return (
    <p role="status" className="mt-3 text-sm text-[var(--muted)]">
      {verdict === "QUEUED" ? "Bài đang chờ trong hàng đợi chấm..." : "Bài đang được chấm..."}
      {" "}Trang sẽ tự cập nhật khi có kết quả.
    </p>
  );
}
