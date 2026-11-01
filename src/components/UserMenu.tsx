"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type UserMenuProps = {
  user: {
    displayName: string;
    username: string;
    role: string;
    avatarMimeType: string | null;
  };
  rank?: { name: string; badge: string };
};

const RANK_COLORS: Record<string, string> = {
  Newbie: "text-slate-300",
  Pupil: "text-emerald-300",
  Specialist: "text-cyan-300",
  Expert: "text-violet-300",
  "Candidate Master": "text-amber-300",
  Admin: "text-amber-300",
  Master: "text-orange-300",
  Grandmaster: "text-rose-300",
  Legend: "text-fuchsia-300",
};

export function UserMenu({ user, rank }: UserMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function logout() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError("Không thể đăng xuất. Hãy thử lại.");
        return;
      }

      setOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      setError("Không thể kết nối để đăng xuất.");
    } finally {
      setPending(false);
    }
  }

  const initials = user.displayName.trim().charAt(0).toUpperCase() || "?";
  const displayedRank = user.role === "ADMIN" ? { name: "Admin", badge: "🛡️" } : rank;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Tài khoản ${user.displayName}`}
        onClick={() => {
          setError("");
          setOpen((value) => !value);
        }}
        className="flex max-w-52 items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)]"
      >
        {user.avatarMimeType ? (
          <img
            src={`/api/users/${encodeURIComponent(user.username)}/avatar`}
            alt=""
            className="size-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--amber)] font-semibold text-[var(--navy)]">
            {initials}
          </span>
        )}
          <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className={`truncate ${RANK_COLORS[displayedRank?.name ?? ""] ?? "text-[var(--cream)]"}`}>{user.displayName}</span>
            {displayedRank && <span title={`Rank ${displayedRank.name}`} className={`shrink-0 text-[10px] font-semibold ${RANK_COLORS[displayedRank.name] ?? (user.role === "ADMIN" ? "text-amber-300" : "text-[var(--cream)]")}`}>{displayedRank.badge} {displayedRank.name}</span>}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 text-[var(--cream)]/70 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        role="menu"
        aria-label="Menu tài khoản"
        aria-hidden={!open}
        inert={!open}
        data-account-menu-panel
        data-open={open}
        className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] shadow-xl"
      >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--navy)]">
              {user.displayName}
            </p>
            {displayedRank && <p className={`mt-1 text-xs font-semibold ${displayedRank.name === "Newbie" ? "text-slate-500" : displayedRank.name === "Admin" ? "text-amber-700" : "text-[var(--teal)]"}`}>{displayedRank.badge} {displayedRank.name}</p>}
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">@{user.username}</p>
          </div>
          <nav className="p-1.5">
            <Link
              role="menuitem"
              href="/profile"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--navy)]/5 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
            >
              Hồ sơ
            </Link>
            <Link
              role="menuitem"
              href="/settings/profile"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--navy)]/5 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
            >
              Cài đặt trang cá nhân
            </Link>
            <Link
              role="menuitem"
              href="/status?myself=1"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--navy)]/5 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
            >
              Lịch sử bài nộp
            </Link>
            <Link
              role="menuitem"
              href="/problems/new"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--navy)]/5 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
            >
              Đóng góp đề
            </Link>
            <Link
              role="menuitem"
              href="/contests"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--navy)]/5 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
            >
              Contest
            </Link>
            {user.role === "ADMIN" && (
              <Link
                role="menuitem"
                href="/admin"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--teal)] hover:bg-[var(--navy)]/5 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
              >
                Quản trị
              </Link>
            )}
          </nav>
          <div className="border-t border-[var(--line)] p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={pending}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              {pending ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
            {error && (
              <p role="alert" className="px-3 pb-1 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>
      </div>
    </div>
  );
}
