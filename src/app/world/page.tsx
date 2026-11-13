import Link from "next/link";
import { WorldPageClient3D } from "@/components/WorldPageClient3D";
import { getCurrentUser } from "@/lib/auth";
import { loadWorldSnapshot } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal)]">A2 Kingdom</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--navy)]">Thế giới 3D</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Đăng nhập để xây vương quốc, sản xuất tài nguyên và tham gia sự kiện.</p>
        <Link href="/login" className="mt-5 inline-flex rounded-lg bg-[var(--teal)] px-4 py-2 font-semibold text-white">
          Đăng nhập
        </Link>
      </div>
    );
  }

  const initialSnapshot = await loadWorldSnapshot(user.id);
  return <WorldPageClient3D initialSnapshot={initialSnapshot} />;
}
