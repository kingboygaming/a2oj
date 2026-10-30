import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/problems", label: "Bài tập" },
  { href: "/status", label: "Bài nộp" },
  { href: "/problems/new", label: "Đóng góp đề" },
  { href: "/contests", label: "Contest" },
];

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-white/10 bg-[var(--surface-strong)] text-[var(--cream)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight">A2OJ</span>
            <span className="hidden text-[11px] text-[var(--cream)]/70 sm:inline">
              Sân chơi cho khối chuyên Tin
            </span>
          </Link>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap items-center gap-1 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-2.5 py-1.5 text-[var(--cream)]/90 hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-2 py-1.5 text-[var(--cream)]/90 hover:bg-white/10"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-[var(--amber)] px-3 py-1.5 font-medium text-[var(--navy)]"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
