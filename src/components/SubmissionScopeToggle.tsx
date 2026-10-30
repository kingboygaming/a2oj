import Link from "next/link";

export function SubmissionScopeToggle({
  mine,
  loggedIn,
}: {
  mine: boolean;
  loggedIn: boolean;
}) {
  return (
    <nav
      aria-label="Phạm vi bài nộp"
      className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--paper)] p-1"
    >
      <Link
        href="/status"
        aria-current={mine ? undefined : "page"}
        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
          mine
            ? "text-[var(--muted)] hover:bg-white"
            : "bg-[var(--surface-strong)] font-medium text-[var(--cream)]"
        }`}
      >
        Toàn hệ thống
      </Link>
      <Link
        href={loggedIn ? "/status?myself=1" : "/login"}
        aria-current={mine ? "page" : undefined}
        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
          mine
            ? "bg-[var(--surface-strong)] font-medium text-[var(--cream)]"
            : "text-[var(--muted)] hover:bg-white"
        }`}
      >
        Bài nộp của tôi
      </Link>
    </nav>
  );
}
