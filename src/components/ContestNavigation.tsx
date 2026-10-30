import Link from "next/link";

type ContestTab = "overview" | "problems" | "standings";

const TABS: { id: ContestTab; label: string; path: string }[] = [
  { id: "overview", label: "Tổng quan", path: "" },
  { id: "problems", label: "Đề bài", path: "/problems" },
  { id: "standings", label: "Bảng xếp hạng", path: "/leaderboard" },
];

export function ContestNavigation({
  slug,
  active,
}: {
  slug: string;
  active: ContestTab;
}) {
  return (
    <nav
      aria-label="Điều hướng contest"
      className="mt-5 flex flex-wrap gap-1 border-b border-[var(--line)]"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/contests/${slug}${tab.path}`}
          prefetch={true}
          aria-current={active === tab.id ? "page" : undefined}
          className={`rounded-t-md px-4 py-2 text-sm font-medium ${
            active === tab.id
              ? "border-b-2 border-[var(--teal)] text-[var(--teal)]"
              : "text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--navy)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
