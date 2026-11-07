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
import { Button } from "./Button";
import { EntertainmentMenu } from "./EntertainmentMenu";

const mainLinks = [
  { href: "/problems", label: "Bài tập", icon: "📝" },
  { href: "/status", label: "Bài nộp", icon: "📊" },
  { href: "/problems/new", label: "Đóng góp đề", icon: "➕" },
  { href: "/contests", label: "Contest", icon: "🏆" },
  { href: "/gacha", label: "Gacha", icon: "🎁" },
  { href: "/wiki", label: "Wiki", icon: "📚" },
  { href: "/leaderboard", label: "Xếp hạng", icon: "📈" },
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
      <header className="site-header sticky top-0 z-50 border-b border-white/10 text-[var(--cream)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              prefetch={true}
              className="group flex items-center gap-2.5 rounded-lg transition-transform hover:scale-105"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--amber)] shadow-md shadow-amber-500/10">
                <span className="text-base font-extrabold text-white">A2</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-base font-bold tracking-tight text-[var(--cream)] group-hover:text-[var(--teal)] transition-colors">
                  A2OJ
                </div>
                <div className="text-[11px] text-[var(--cream)]/60 leading-none">
                  Chuyên Tin
                </div>
              </div>
            </Link>
          </div>

          {/* Main Navigation */}
          <nav
            aria-label="Điều hướng chính"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={true}
                  className="group relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-[var(--cream)]/85 transition-all hover:bg-white/10 hover:text-white"
                >
                  <span className="text-xs opacity-75" aria-hidden="true">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>

            {/* Entertainment Dropdown - outside overflow-x-auto so dropdown is never clipped */}
            <EntertainmentMenu />
          </nav>

          {/* User Actions & Toolbar */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1">
              <BackgroundPicker />
              <SoundToggle />
              <LedToggle />
              <ThemeToggle />
            </div>

            {user ? (
              <UserMenu 
                user={user} 
                rank={rank ? { name: rank.name, badge: rank.badge } : undefined} 
                nameColorClass={rankSummary?.nameColor} 
              />
            ) : (
              <div className="flex items-center gap-2">
                <LoginDialog />
                <Button 
                  href="/register" 
                  variant="primary" 
                  size="sm"
                  className="shadow-sm font-semibold"
                >
                  Đăng ký
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <AchievementUnlockToast achievements={newAchievements} />
    </>
  );
}
