"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function HomeRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
    >
      {pending ? "Đang tải..." : "Tải lại"}
    </button>
  );
}
