"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const entertainmentLinks = [
  {
    href: "/world",
    label: "Thế giới",
    description: "Xây căn cứ, sản xuất tài nguyên và dự sự kiện",
    icon: "🌍",
  },
  {
    href: "/chess",
    label: "Chess Arena",
    description: "Đấu cờ vua trực tiếp trên cùng máy",
    icon: "♟️",
  },
  {
    href: "/battle",
    label: "Đấu bài PvP",
    description: "Tạo phòng hoặc nhập mã tham gia",
    icon: "🎴",
  },
  {
    href: "/market",
    label: "Chợ Thẻ & Shop Điểm",
    description: "Trao đổi thẻ và mua sắm bằng điểm AC",
    icon: "🏛️",
  },
];

export function EntertainmentMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--cream)]/85 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
      >
        <span className="text-xs" aria-hidden="true">🎮</span>
        <span>Giải trí</span>
        <span
          className={`text-[10px] transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--teal)]" : ""
          }`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {open && (
        <div className="absolute right-0 sm:left-0 top-full z-[130] mt-2 w-64 origin-top-left rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-1.5 text-[var(--cream)] shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/50">
            Khu vực giải trí
          </div>
          {entertainmentLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              onClick={() => setOpen(false)}
              className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/10"
            >
              <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">
                {link.icon}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-[var(--cream)] group-hover:text-[var(--teal)] transition-colors">
                  {link.label}
                </div>
                <div className="text-xs text-[var(--cream)]/60 leading-snug mt-0.5">
                  {link.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}