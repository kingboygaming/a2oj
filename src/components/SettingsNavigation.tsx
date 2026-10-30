"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/settings/profile", label: "Thông tin cá nhân" },
  { href: "/settings/security", label: "Mật khẩu" },
  { href: "/settings/email", label: "Email liên kết" },
];

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Cài đặt tài khoản"
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
    >
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium ${
              active
                ? "bg-[var(--teal)]/10 text-[var(--teal)]"
                : "text-[var(--muted)] hover:bg-[var(--navy)]/5 hover:text-[var(--navy)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
