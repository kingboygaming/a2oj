import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";
import { LedToggle } from "./LedToggle";
import { SoundToggle } from "./SoundToggle";
import { BackgroundPicker } from "./BackgroundPicker";
import { getUserRankSummary, recordNewAchievementUnlocks } from "@/lib/ranks";
import { AchievementUnlockToast } from "./AchievementUnlockToast";
import { LoginDialog } from "./LoginDialog";

const links = [
  { href: "/problems", label: "Bài tập" },
  { href: "/status", label: "Bài nộp" },
  { href: "/problems/new", label: "Đóng góp đề" },
  { href: "/contests", label: "Contest" },
  { href: "/gacha", label: "Gacha" },
  { href: "/wiki", label: "Wiki" },
  { href: "/leaderboard", label: "Xếp hạng" },
];

export async function Header() {
  const user = await getCurrentUser();
  const rankSummary = user ? await getUserRankSummary(user.id) : undefined;
  const newAchievements = user && rankSummary
    ? await recordNewAchievementUnlocks(user.id, rankSummary.badges)
    : [];
  const rank = rankSummary?.rank;

  return (
    <>
    <header className="site-header border-b border-white/10 text-[var(--cream)]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-6">
          <Link href="/" prefetch={true} className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight">A2OJ</span>
            <span className="hidden text-[11px] text-[var(--cream)]/70 sm:inline">
              Sân chơi cho khối chuyên Tin
            </span>
          </Link>
          <nav
            aria-label="Điều hướng chính"
            className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 whitespace-nowrap text-sm"
          >
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={true}
                  className="rounded-md px-2.5 py-1.5 text-[var(--cream)]/90 hover:bg-white/10"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <details className="group relative shrink-0">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1.5 text-[var(--cream)]/90 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                Giải trí
                <span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="absolute left-0 top-full z-[120] mt-1 min-w-48 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-1.5 text-[var(--cream)] shadow-xl">
                <Link
                  href="/battle"
                  prefetch={true}
                  className="block rounded-md px-3 py-2.5 hover:bg-white/10"
                >
                  <span className="block font-medium">🎴 Đấu bài PvP</span>
                  <span className="mt-0.5 block text-xs text-[var(--cream)]/65">Tạo phòng hoặc nhập mã tham gia</span>
                </Link>
              </div>
            </details>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <BackgroundPicker />
          <SoundToggle />
          <LedToggle />
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} rank={rank ? { name: rank.name, badge: rank.badge } : undefined} nameColorClass={rankSummary?.nameColor} />
          ) : (
            <>
              <LoginDialog />
              <Link
                href="/register"
                prefetch={true}
                className="rounded-md bg-[var(--amber)] px-3 py-1.5 font-medium text-[var(--navy)] hover:opacity-90"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
    <AchievementUnlockToast achievements={newAchievements} />
    </>
  );
}
