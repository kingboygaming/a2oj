"use client";

import Link from "next/link";
import { useState } from "react";

export function VerifyEmailForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function verifyEmail() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không xác minh được email.");
        return;
      }
      setMessage("Email đã được xác minh và liên kết với tài khoản.");
    } catch {
      setError("Không thể kết nối để xác minh email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        onClick={verifyEmail}
        disabled={pending || !token}
        className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Đang xác minh..." : "Xác minh email"}
      </button>
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message} <Link href="/settings/email" className="underline">Về cài đặt email</Link>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
