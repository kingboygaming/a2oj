import Link from "next/link";
import { redirect } from "next/navigation";
import { SettingsNavigation } from "@/components/SettingsNavigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: LayoutProps<"/settings">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
            Tài khoản
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">
            Cài đặt trang cá nhân
          </h1>
        </div>
        <Link href="/profile" className="text-sm font-medium text-[var(--teal)] hover:underline">
          Quay lại hồ sơ
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-[var(--line)] bg-[var(--paper)] p-2">
          <SettingsNavigation />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
