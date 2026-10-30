"use client";

import { useRouter } from "next/navigation";

export function PreviousPageButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="mb-4 inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm font-medium text-[var(--navy)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
    >
      ← Quay lại
    </button>
  );
}
