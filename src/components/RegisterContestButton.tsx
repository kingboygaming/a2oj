"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterContestButton({
  contestId,
  joined,
}: {
  contestId: string;
  joined: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(joined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function register() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/contests/${contestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không đăng ký được contest.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Không thể kết nối để đăng ký contest.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <span className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
        Đã đăng ký
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={register}
        disabled={pending}
        className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm text-white disabled:opacity-60"
      >
        {pending ? "Đang đăng ký..." : "Đăng ký thi"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
