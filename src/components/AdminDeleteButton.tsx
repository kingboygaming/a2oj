"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDeleteButton({
  endpoint,
  confirmation,
}: {
  endpoint: string;
  confirmation: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(confirmation)) return;

    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không thể xóa dữ liệu.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không thể kết nối để xóa dữ liệu. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        {pending ? "Đang xóa..." : "Xóa"}
      </button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
