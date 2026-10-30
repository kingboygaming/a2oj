"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-md px-2.5 py-1.5 text-[var(--cream)]/80 hover:bg-white/10"
    >
      Thoát
    </button>
  );
}
